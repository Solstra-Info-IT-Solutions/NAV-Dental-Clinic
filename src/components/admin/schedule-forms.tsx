"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { InputField, SelectField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

import { ConfirmButton } from "./confirm-button";
import { useAdminRequest } from "./use-admin-request";

type Summary = { id: string; reference: string; patientName: string; start: string };

function AffectedList({ items, title }: { items: Summary[]; title: string }) {
  if (items.length === 0) return null;
  return (
    <Alert kind="warning" title={title}>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((a) => (
          <li key={a.id}>
            <Link href={`/admin/appointments/${a.id}`} className="underline">
              {a.patientName} ({a.reference})
            </Link>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

export function SlotBlockForm({ date, capacity }: { date: string; capacity: number }) {
  const { send, pending, error } = useAdminRequest();
  const [done, setDone] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setDone(false);
    const result = await send("/api/admin/slot-blocks", "POST", {
      date: form.get("date"),
      startTime: form.get("startTime"),
      endTime: form.get("endTime"),
      resourceKey: form.get("resourceKey"),
      reason: form.get("reason"),
    });
    if (result.ok) {
      setDone(true);
      event.currentTarget?.reset();
    }
  }
  const conflicts = (error?.conflicts as Summary[] | undefined) ?? [];
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert kind="error" title={error.message} live /> : null}
      <AffectedList items={conflicts} title="These appointments already use that time" />
      {done ? <Alert kind="success" title="Time blocked." live /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField id="block-date" name="date" label="Date" type="date" defaultValue={date} required error={error?.fields?.date} />
        <SelectField id="block-chair" name="resourceKey" label="Chair" defaultValue="all">
          <option value="all">All chairs</option>
          {Array.from({ length: capacity }, (_, i) => (
            <option key={i} value={`chair-${i + 1}`}>
              Chair {i + 1}
            </option>
          ))}
        </SelectField>
        <InputField id="block-start" name="startTime" label="From" type="time" step={300} required error={error?.fields?.startTime} />
        <InputField id="block-end" name="endTime" label="Until" type="time" step={300} required error={error?.fields?.endTime} />
      </div>
      <InputField id="block-reason" name="reason" label="Reason (internal)" required maxLength={120} error={error?.fields?.reason} />
      <Button type="submit" variant="secondary" loading={pending}>
        Block time
      </Button>
    </form>
  );
}

export function DeleteBlockButton({ id }: { id: string }) {
  const { send } = useAdminRequest();
  return (
    <ConfirmButton
      label="Remove block"
      title="Remove this block?"
      description="The time becomes available for booking again."
      confirmLabel="Remove block"
      variant="ghost"
      onConfirm={async () => {
        const r = await send(`/api/admin/slot-blocks/${id}`, "DELETE");
        return r.ok ? undefined : r.error.message;
      }}
    />
  );
}

export function ClosureForm() {
  const { send, pending, error } = useAdminRequest();
  const [allDay, setAllDay] = useState(true);
  const [affected, setAffected] = useState<Summary[] | null>(null);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setAffected(null);
    const result = await send<{ id: string; affectedAppointments: Summary[] }>("/api/admin/closures", "POST", {
      startDate: form.get("startDate"),
      endDate: form.get("endDate"),
      allDay,
      startTime: allDay ? undefined : form.get("startTime"),
      endTime: allDay ? undefined : form.get("endTime"),
      reason: form.get("reason"),
      publicNote: form.get("publicNote") || undefined,
    });
    if (result.ok) {
      setAffected(result.data.affectedAppointments);
      event.currentTarget?.reset();
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert kind="error" title={error.message} live /> : null}
      {affected ? (
        affected.length ? (
          <AffectedList items={affected} title="Closure saved. These patients have appointments in that period — please contact them to reschedule:" />
        ) : (
          <Alert kind="success" title="Closure saved. No existing appointments are affected." live />
        )
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField id="closure-start" name="startDate" label="From date" type="date" required error={error?.fields?.startDate} />
        <InputField id="closure-end" name="endDate" label="To date" type="date" required error={error?.fields?.endDate} />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-ink-900" />
        Closed all day
      </label>
      {!allDay ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField id="closure-from" name="startTime" label="Closed from" type="time" required error={error?.fields?.startTime} />
          <InputField id="closure-until" name="endTime" label="Closed until" type="time" required />
        </div>
      ) : null}
      <InputField id="closure-reason" name="reason" label="Reason (internal)" required maxLength={120} />
      <InputField id="closure-note" name="publicNote" label="Public note" optional hint="For example “Closed for Diwali”." maxLength={120} />
      <Button type="submit" variant="secondary" loading={pending}>
        Add closure
      </Button>
    </form>
  );
}

export function DeleteClosureButton({ id }: { id: string }) {
  const { send } = useAdminRequest();
  return (
    <ConfirmButton
      label="Remove"
      title="Remove this closure?"
      description="Online booking will be possible again for these dates (within opening hours)."
      confirmLabel="Remove closure"
      variant="ghost"
      onConfirm={async () => {
        const r = await send(`/api/admin/closures/${id}`, "DELETE");
        return r.ok ? undefined : r.error.message;
      }}
    />
  );
}
