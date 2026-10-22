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
