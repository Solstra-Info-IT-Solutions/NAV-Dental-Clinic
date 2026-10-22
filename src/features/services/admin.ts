import "server-only";

import { Types } from "mongoose";
import { z } from "zod";

import { recordAudit, type AuditActor } from "@/features/audit/service";
import { AppointmentModel, ServiceModel, type ServiceDoc } from "@/lib/db/models";
import { AppError, isDuplicateKeyError } from "@/lib/errors";

const text = (max: number) => z.string().trim().max(max);

export const serviceInputSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.").max(60),
  title: text(80).min(2, "Enter a title."),
  summary: text(200).min(10, "Write a short summary (10–200 characters)."),
  sections: z.array(z.object({ heading: text(100).min(2), paragraphs: z.array(text(3000).min(1)).min(1).max(10) })).max(8),
  faqs: z.array(z.object({ q: text(200).min(5), a: text(1000).min(5) })).max(10),
  durationMinutes: z.number().int().min(10).max(480).multipleOf(5).nullable().optional(),
  published: z.boolean(),
  bookable: z.boolean(),
  order: z.number().int().min(0).max(999),
  seo: z.object({ title: text(60).optional(), description: text(160).optional() }).optional(),
});
export type ServiceInput = z.infer<typeof serviceInputSchema>;

export type AdminService = ServiceInput & { id: string; redirectFrom: string[]; updatedAt: string };

function toAdmin(doc: ServiceDoc & { _id: Types.ObjectId; updatedAt?: Date }): AdminService {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    sections: (doc.sections ?? []).map((s) => ({ heading: s.heading, paragraphs: [...(s.paragraphs ?? [])] })),
    faqs: (doc.faqs ?? []).map((f) => ({ q: f.q, a: f.a })),
    durationMinutes: doc.durationMinutes ?? null,
    published: doc.published,
    bookable: doc.bookable,
    order: doc.order,
    seo: { title: doc.seo?.title ?? undefined, description: doc.seo?.description ?? undefined },
    redirectFrom: [...(doc.redirectFrom ?? [])],
    updatedAt: (doc.updatedAt ?? new Date(0)).toISOString(),
  };
}

export async function listAllServices(): Promise<AdminService[]> {
  const docs = await ServiceModel.find().sort({ order: 1, title: 1 }).lean<(ServiceDoc & { _id: Types.ObjectId; updatedAt: Date })[]>().exec();
  return docs.map(toAdmin);
}

export async function getService(id: string): Promise<AdminService> {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND");
  const doc = await ServiceModel.findById(id).lean<ServiceDoc & { _id: Types.ObjectId; updatedAt: Date }>().exec();
  if (!doc) throw new AppError("NOT_FOUND");
  return toAdmin(doc);
}

export async function createService(input: ServiceInput, actor: AuditActor): Promise<AdminService> {
  try {
    const doc = await ServiceModel.create({ ...input, durationMinutes: input.durationMinutes ?? undefined });
    await recordAudit({ actor, action: "service.created", entity: "service", entityId: String(doc._id), changes: [{ field: "slug", to: input.slug }] });
    return toAdmin(doc.toObject() as ServiceDoc & { _id: Types.ObjectId; updatedAt: Date });
  } catch (error) {
    if (isDuplicateKeyError(error, "slug")) throw new AppError("CONFLICT", { fields: { slug: "Another service already uses this address." } });
    throw error;
  }
}

function withoutDuration(input: ServiceInput): Omit<ServiceInput, "durationMinutes"> {
  const { durationMinutes, ...rest } = input;
  void durationMinutes;
  return rest;
}

/** Full update. A changed slug keeps the old one in `redirectFrom` so old links can redirect (Phase 7). */
export async function updateService(id: string, input: ServiceInput, actor: AuditActor): Promise<AdminService> {
  const current = await getService(id);
  const redirectFrom = new Set(current.redirectFrom);
  if (input.slug !== current.slug) redirectFrom.add(current.slug);
  redirectFrom.delete(input.slug);
  try {
    const doc = await ServiceModel.findByIdAndUpdate(
      id,
      input.durationMinutes == null
        ? { $set: { ...withoutDuration(input), redirectFrom: [...redirectFrom] }, $unset: { durationMinutes: 1 } }
        : { $set: { ...input, redirectFrom: [...redirectFrom] } },
      { returnDocument: "after", runValidators: true },
    )
      .lean<ServiceDoc & { _id: Types.ObjectId; updatedAt: Date }>()
      .exec();
    if (!doc) throw new AppError("NOT_FOUND");
    const changed = (Object.keys(input) as (keyof ServiceInput)[]).filter((k) => JSON.stringify(input[k] ?? null) !== JSON.stringify(current[k] ?? null));
    await recordAudit({ actor, action: "service.updated", entity: "service", entityId: id, changes: changed.map((field) => ({ field: String(field) })) });
    return toAdmin(doc);
  } catch (error) {
    if (isDuplicateKeyError(error, "slug")) throw new AppError("CONFLICT", { fields: { slug: "Another service already uses this address." } });
    throw error;
  }
}

/** Deletion is refused once any appointment references the service; unpublish it instead. */
export async function deleteService(id: string, actor: AuditActor): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND");
  if (await AppointmentModel.exists({ serviceId: id })) {
    throw new AppError("CONFLICT", { message: "This service has appointments. Unpublish it instead of deleting it." });
  }
  const doc = await ServiceModel.findByIdAndDelete(id).lean().exec();
  if (!doc) throw new AppError("NOT_FOUND");
  await recordAudit({ actor, action: "service.deleted", entity: "service", entityId: id, changes: [{ field: "slug", from: doc.slug }] });
}
