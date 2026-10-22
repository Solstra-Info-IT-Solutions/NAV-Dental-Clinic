import "server-only";

import { Types } from "mongoose";

import { recordAudit, type AuditActor } from "@/features/audit/service";
import { EnquiryModel, type EnquiryDoc } from "@/lib/db/models";
import { AppError, isDuplicateKeyError } from "@/lib/errors";
import { toCsv } from "@/lib/csv";
import { logger, maskPhone } from "@/lib/logger";
import { isValidLocalDate, localDayBounds } from "@/lib/time/ist";

import type { EnquiryRequest, EnquiryStatus } from "./schemas";

export type StoredEnquiry = EnquiryDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

/** Spam-marked enquiries are kept this long for review, then deleted by the TTL index. */
export const SPAM_RETENTION_DAYS = 30;

const URL_PATTERN = /(https?:\/\/|www\.)\S+/gi;

/**
 * Lightweight content score for messages that pass the hard checks (honeypot,
 * timing, rate limits). Suspicious messages are still stored, but as `spam`,
 * so staff can review them and nothing genuine is silently lost.
 */
export function contentSpamScore(message: string): number {
  let score = 0;
  const links = message.match(URL_PATTERN)?.length ?? 0;
  if (links >= 3) score += 3;
  else if (links > 0) score += 1;
  if (/\b(crypto|bitcoin|casino|seo services|backlinks|loan offer|viagra)\b/i.test(message)) score += 3;
  if (/(.)\1{9,}/.test(message)) score += 1;
  return score;
}

const SPAM_THRESHOLD = 3;

export type CreateEnquiryResult = { enquiry: StoredEnquiry; replayed: boolean; flaggedAsSpam: boolean };

export async function createEnquiry(
  request: EnquiryRequest,
  meta: { ipHash?: string; fillMs: number; now?: Date },
): Promise<CreateEnquiryResult> {
  const existing = await EnquiryModel.findOne({ idempotencyKey: request.idempotencyKey }).lean<StoredEnquiry>().exec();
  if (existing) return { enquiry: existing, replayed: true, flaggedAsSpam: existing.status === "spam" };

  const now = meta.now ?? new Date();
  const score = contentSpamScore(request.message);
  const flaggedAsSpam = score >= SPAM_THRESHOLD;

  try {
    const doc = await EnquiryModel.create({
      name: request.name,
      phoneE164: request.phone,
      email: request.email,
      category: request.category,
      message: request.message,
      status: flaggedAsSpam ? "spam" : "new",
      spam: { honeypot: false, fillMs: meta.fillMs, score },
      privacyAcknowledgedAt: now,
      idempotencyKey: request.idempotencyKey,
      requestMeta: { ipHash: meta.ipHash },
      ...(flaggedAsSpam ? { spamExpiresAt: new Date(now.getTime() + SPAM_RETENTION_DAYS * 86_400_000) } : {}),
    });
    logger.info("enquiry.created", { enquiryId: String(doc._id), category: request.category, flaggedAsSpam, phone: maskPhone(request.phone) });
    return { enquiry: doc.toObject() as StoredEnquiry, replayed: false, flaggedAsSpam };
  } catch (error) {
    // A simultaneous duplicate submission won the race: return that one.
    if (isDuplicateKeyError(error, "idempotencyKey")) {
      const winner = await EnquiryModel.findOne({ idempotencyKey: request.idempotencyKey }).lean<StoredEnquiry>().exec();
      if (winner) return { enquiry: winner, replayed: true, flaggedAsSpam: winner.status === "spam" };
    }
    throw error;
  }
}

/**
 * Staff status change with an optional internal note. Marking as spam starts
 * the 30-day deletion timer; moving out of spam cancels it.
 */
export async function updateEnquiry(params: {
  enquiryId: string;
  status?: EnquiryStatus;
  note?: string;
  actor: AuditActor;
  now?: Date;
}): Promise<StoredEnquiry> {
  if (!Types.ObjectId.isValid(params.enquiryId)) throw new AppError("NOT_FOUND");
  if (!params.status && !params.note) throw new AppError("VALIDATION_FAILED", { fields: { status: "Choose a status or add a note." } });
  const now = params.now ?? new Date();

  const current = await EnquiryModel.findById(params.enquiryId).lean<StoredEnquiry>().exec();
  if (!current) throw new AppError("NOT_FOUND");
  if (params.status && params.status === current.status && !params.note) {
    throw new AppError("INVALID_TRANSITION", { message: `The enquiry is already ${current.status.replace("_", " ")}.` });
  }

  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  if (params.status && params.status !== current.status) {
    set.status = params.status;
    if (params.status === "spam") set.spamExpiresAt = new Date(now.getTime() + SPAM_RETENTION_DAYS * 86_400_000);
    else unset.spamExpiresAt = 1;
  }

  const actorId = params.actor !== "system" ? params.actor.id : undefined;
  const updated = await EnquiryModel.findOneAndUpdate(
    { _id: current._id, status: current.status },
    {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
      ...(params.note ? { $push: { notes: { at: now, by: actorId, text: params.note } } } : {}),
    },
    { returnDocument: "after", runValidators: true },
  )
    .lean<StoredEnquiry>()
    .exec();
  if (!updated) throw new AppError("CONFLICT", { message: "The enquiry was changed by someone else. Reload and try again." });

  await recordAudit({
    actor: params.actor,
    action: "enquiry.updated",
    entity: "enquiry",
    entityId: String(current._id),
    changes: [
      ...(set.status ? [{ field: "status", from: current.status, to: set.status }] : []),
      ...(params.note ? [{ field: "notes", to: "[added]" }] : []),
    ],
  });
  return updated;
}

export type EnquiryListQuery = { page: number; pageSize: number; status?: EnquiryStatus[]; q?: string; from?: Date; to?: Date };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Paginated staff listing (used by the admin dashboard in Phase 6). */
export async function listEnquiries(query: EnquiryListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.status?.length) filter.status = { $in: query.status };
  if (query.from || query.to) filter.createdAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lt: query.to } : {}) };
  if (query.q) {
    const term = query.q.trim().slice(0, 60);
    const digits = term.replace(/\D/g, "");
    filter.$or = [{ name: { $regex: escapeRegex(term), $options: "i" } }, ...(digits.length >= 4 ? [{ phoneE164: { $regex: escapeRegex(digits) } }] : [])];
  }
  const [items, total] = await Promise.all([
    EnquiryModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<StoredEnquiry[]>()
      .exec(),
    EnquiryModel.countDocuments(filter),
  ]);
  return { items, page: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
}

export async function getEnquiry(id: string): Promise<StoredEnquiry> {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND");
  const doc = await EnquiryModel.findById(id).lean<StoredEnquiry>().exec();
  if (!doc) throw new AppError("NOT_FOUND");
  return doc;
}

/** Owner CSV export of non-spam enquiries in a date range (max 92 days). */
export async function exportEnquiriesCsv(params: { from: string; to: string }): Promise<string> {
  if (!isValidLocalDate(params.from) || !isValidLocalDate(params.to) || params.from > params.to) {
    throw new AppError("VALIDATION_FAILED", { fields: { from: "Choose a valid date range." } });
  }
  const start = localDayBounds(params.from).start;
  const end = localDayBounds(params.to).end;
  if (end.getTime() - start.getTime() > 93 * 86_400_000) throw new AppError("VALIDATION_FAILED", { fields: { to: "Export at most 92 days at a time." } });
  const docs = await EnquiryModel.find({ createdAt: { $gte: start, $lt: end }, status: { $ne: "spam" } }).sort({ createdAt: 1 }).lean<StoredEnquiry[]>().exec();
  return toCsv(
    ["Received", "Name", "Mobile", "Email", "Topic", "Status", "Message"],
    docs.map((e) => [e.createdAt, e.name, e.phoneE164, e.email ?? "", e.category, e.status, e.message]),
  );
}

