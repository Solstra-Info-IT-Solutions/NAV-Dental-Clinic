import "server-only";

import { recordAudit, type AuditActor, type AuditChange } from "@/features/audit/service";
import { AppError } from "@/lib/errors";
import { ClinicSettingsModel, type ClinicSettingsDoc } from "@/lib/db/models";
import { parseOrThrow } from "@/lib/validation";

import { DEFAULT_PUBLIC_SETTINGS } from "./defaults";
import { clinicSettingsInputSchema, type ClinicSettingsInput } from "./schemas";
import { WEEKDAYS, type PublicClinicSettings } from "./types";

export const SETTINGS_ID = "default";

/** Seed values: verified client facts + owner-approved defaults. */
export function defaultSettingsInput(): ClinicSettingsInput {
  const d = DEFAULT_PUBLIC_SETTINGS;
  return clinicSettingsInputSchema.parse({
    clinicName: d.clinicName,
    doctorName: d.doctorName,
    phoneE164: d.phoneE164,
    address: d.address,
    weeklyHours: d.weeklyHours,
    bookingMode: d.bookingMode,
    bookingEnabled: d.bookingEnabled,
    legalPagesApproved: d.legalPagesApproved,
  });
}

/** Strips `null`s and Mongo-only fields; never leaks staff emails or internals. */
export function toPublicSettings(doc: ClinicSettingsDoc): PublicClinicSettings {
  const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined || v === "" ? undefined : v);
  const social = Object.fromEntries(Object.entries(doc.social ?? {}).filter(([, v]) => typeof v === "string" && v.length > 0)) as PublicClinicSettings["social"];
  return {
    clinicName: doc.clinicName,
    doctorName: doc.doctorName,
    doctorCredentials: opt(doc.doctorCredentials),
    phoneE164: doc.phoneE164,
    whatsappE164: doc.whatsappEnabled ? (opt(doc.whatsappE164) ?? doc.phoneE164) : undefined,
    email: opt(doc.email),
    address: {
      line1: doc.address.line1,
      line2: opt(doc.address.line2),
      locality: doc.address.locality,
      district: doc.address.district,
      state: doc.address.state,
      postalCode: opt(doc.address.postalCode),
      country: "IN",
    },
    mapUrl: opt(doc.mapUrl),
    geo: doc.geo ? { lat: doc.geo.lat, lng: doc.geo.lng } : undefined,
    social,
    weeklyHours: Object.fromEntries(
      WEEKDAYS.map((day) => [day, (doc.weeklyHours?.[day] ?? []).map((i) => ({ open: i.open, close: i.close }))]),
    ) as PublicClinicSettings["weeklyHours"],
    bookingEnabled: doc.bookingEnabled,
    bookingMode: doc.bookingMode,
    legalPagesApproved: doc.legalPagesApproved,
    seo: { defaultTitle: opt(doc.seo?.defaultTitle), defaultDescription: opt(doc.seo?.defaultDescription) },
  };
}

export async function findSettings(): Promise<ClinicSettingsDoc | null> {
  return ClinicSettingsModel.findById(SETTINGS_ID).lean<ClinicSettingsDoc>().exec();
}

/** Inserts defaults only if no settings exist. Never overwrites edited settings. */
export async function seedSettings(): Promise<{ created: boolean }> {
  const result = await ClinicSettingsModel.updateOne(
    { _id: SETTINGS_ID },
    { $setOnInsert: { _id: SETTINGS_ID, ...defaultSettingsInput(), version: 1 } },
    { upsert: true, runValidators: true },
  );
  return { created: result.upsertedCount === 1 };
}

/**
 * Optimistic-concurrency update: the caller sends the version it edited.
 * The merged result is validated as a whole before saving.
 */
export async function updateSettings(params: {
  expectedVersion: number;
  changes: Partial<ClinicSettingsInput>;
  actor: AuditActor;
}): Promise<ClinicSettingsDoc> {
  const current = await findSettings();
  if (!current) throw new AppError("NOT_FOUND", { message: "Clinic settings have not been initialised. Run npm run db:init." });
  if (current.version !== params.expectedVersion) throw new AppError("VERSION_CONFLICT");

  const merged = parseOrThrow(clinicSettingsInputSchema, { ...stripMeta(current), ...params.changes });

  const updated = await ClinicSettingsModel.findOneAndUpdate(
    { _id: SETTINGS_ID, version: params.expectedVersion },
    { $set: { ...merged, ...(params.actor !== "system" && params.actor.id ? { updatedBy: params.actor.id } : {}) }, $inc: { version: 1 } },
    { returnDocument: "after", runValidators: true },
  )
    .lean<ClinicSettingsDoc>()
    .exec();
  if (!updated) throw new AppError("VERSION_CONFLICT");

  const changes: AuditChange[] = Object.keys(params.changes).map((field) => ({
    field,
    from: (current as Record<string, unknown>)[field],
    to: (updated as Record<string, unknown>)[field],
  }));
  await recordAudit({ actor: params.actor, action: "settings.updated", entity: "clinic_settings", entityId: SETTINGS_ID, changes });
  return updated;
}

/** Editable fields of the stored document, with Mongo `null`s turned into `undefined` for Zod. */
function stripMeta(doc: ClinicSettingsDoc): Record<string, unknown> {
  const source = doc as unknown as Record<string, unknown>;
  const editable = Object.keys(clinicSettingsInputSchema.shape).filter((key) => source[key] !== undefined && source[key] !== null);
  const picked = Object.fromEntries(editable.map((key) => [key, source[key]]));
  return JSON.parse(JSON.stringify(picked, (_key, value: unknown) => (value === null ? undefined : value))) as Record<string, unknown>;
}

export type AdminSettings = ClinicSettingsInput & { version: number; updatedAt?: string };

/** Full editable settings plus version, for the owner's settings screen. */
export async function getAdminSettings(): Promise<AdminSettings> {
  const doc = await findSettings();
  if (!doc) throw new AppError("NOT_FOUND", { message: "Clinic settings have not been initialised. Run npm run db:init." });
  const editable = clinicSettingsInputSchema.parse(stripMeta(doc));
  return { ...editable, version: doc.version, updatedAt: (doc as { updatedAt?: Date }).updatedAt?.toISOString() };
}

