import "server-only";

import type { ClientSession, Types } from "mongoose";

import { AuditLogModel } from "@/lib/db/models";

export type AuditActor = { id?: Types.ObjectId | string; email?: string } | "system";

export type AuditChange = { field: string; from?: unknown; to?: unknown };

/** Fields whose values must not be copied into the audit trail. */
const SENSITIVE_FIELDS = /(phone|email|name|message|notes?|password|token)/i;

export function minimiseChanges(changes: AuditChange[]): AuditChange[] {
  return changes.map((c) => (SENSITIVE_FIELDS.test(c.field) ? { field: c.field, from: "[changed]", to: "[changed]" } : c));
}

export async function recordAudit(
  entry: { actor: AuditActor; action: string; entity: string; entityId: string; changes?: AuditChange[]; ipHash?: string },
  session?: ClientSession,
): Promise<void> {
  const actor = entry.actor === "system" ? {} : { actorId: entry.actor.id, actorEmail: entry.actor.email };
  await AuditLogModel.create(
    [
      {
        ...actor,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        changes: minimiseChanges(entry.changes ?? []),
        ipHash: entry.ipHash,
        at: new Date(),
      },
    ],
    { session },
  );
}

/** Paginated, newest-first audit trail for owners. */
export async function listAudit(query: { page: number; pageSize: number; entity?: string; entityId?: string }) {
  const filter: Record<string, unknown> = {};
  if (query.entity) filter.entity = query.entity;
  if (query.entityId) filter.entityId = query.entityId;
  const [items, total] = await Promise.all([
    AuditLogModel.find(filter)
      .sort({ at: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean()
      .exec(),
    AuditLogModel.countDocuments(filter),
  ]);
  return {
    items: items.map((a) => ({
      id: String(a._id),
      at: a.at.toISOString(),
      actorEmail: a.actorEmail ?? "system",
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      changes: a.changes.map((c) => ({ field: c.field, from: c.from, to: c.to })),
    })),
    page: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
  };
}

