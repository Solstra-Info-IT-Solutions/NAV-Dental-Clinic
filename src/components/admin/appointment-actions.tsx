"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import type { AppointmentStatus } from "@/features/appointments/status-machine";
import { STATUS_LABELS } from "@/features/appointments/status-machine";

import { ConfirmButton } from "./confirm-button";
import { useAdminRequest } from "./use-admin-request";

type Transition = { to: Exclude<AppointmentStatus, "pending">; label: string; description: string; danger?: boolean; notify?: boolean };

const TRANSITION_COPY: Record<Exclude<AppointmentStatus, "pending">, Omit<Transition, "to">> = {
  confirmed: { label: "Confirm", description: "Mark this appointment as confirmed. Do this after agreeing the time with the patient.", notify: true },
  rejected: { label: "Reject request", description: "The requested time cannot be offered. The slot is released.", danger: true, notify: true },
  cancelled: { label: "Cancel", description: "Cancel this appointment. The slot is released for other patients.", danger: true, notify: true },
  reschedule_requested: { label: "Needs new time", description: "Mark that a new time must be agreed. The current slot stays reserved until you reschedule or cancel." },
  completed: { label: "Mark completed", description: "Record that the visit took place." },
  no_show: { label: "Mark no-show", description: "Record that the patient did not attend. The slot is released.", danger: true },
};

export function AppointmentStatusActions({ id, allowed }: { id: string; allowed: Exclude<AppointmentStatus, "pending">[] }) {
  const { send } = useAdminRequest();
  if (allowed.length === 0) return <p className="text-sm text-graphite-600">No further status changes are possible.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {allowed.map((to) => {
        const copy = TRANSITION_COPY[to];
        return (
          <ConfirmButton
            key={to}
            label={copy.label}
            title={`${copy.label}?`}
            description={copy.description}
            confirmLabel={copy.label}
            variant={to === "confirmed" ? "primary" : "secondary"}
            danger={copy.danger}
            withNote
            withNotify={copy.notify}
            onConfirm={async ({ note, notify }) => {
              const result = await send(`/api/admin/appointments/${id}/status`, "POST", { to, note: note || undefined, notifyPatient: notify });
              return result.ok ? undefined : result.error.message;
            }}
          />
        );
      })}
    </div>
  );
}

type Slot = { start: string; label: string };

export function RescheduleForm({ id, today }: { id: string; today: string }) {
  const { send, pending, error } = useAdminRequest();
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [notify, setNotify] = useState(true);
  const [done, setDone] = useState(false);

  async function loadSlots(value: string) {
    setDate(value);
    setStart("");
    setSlots(null);
    setLoadError(null);
    if (!value) return;
    const response = await fetch(`/api/admin/slots?date=${value}&exclude=${id}`);
    const json = await response.json().catch(() => null);
    if (response.ok && json?.data) setSlots(json.data.slots);
    else setLoadError(json?.error?.message ?? "Could not load times.");
  }

  return (
    <div className="space-y-3">
      <label className="grid max-w-xs gap-1 text-sm font-semibold">
        New date
        <input type="date" min={today} value={date} onChange={(e) => void loadSlots(e.target.value)} className="min-h-11 rounded-sm border border-steel-400 px-3 font-normal" />
      </label>
      {loadError ? <Alert kind="error" title={loadError} /> : null}
      {slots && slots.length === 0 ? <p className="text-sm text-graphite-600">No free times on this date.</p> : null}
      {slots && slots.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">New time</legend>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <label key={s.start} className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-ink-900 ${start === s.start ? "border-ink-900 bg-ink-900 text-platinum-100" : "border-silver-200 bg-white"}`}>
                <input type="radio" name="reschedule-time" value={s.start} checked={start === s.start} onChange={() => setStart(s.start)} className="sr-only" />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-ink-900" />
        Email the patient about the new time
      </label>
      {error ? <Alert kind="error" title={error.message} live /> : null}
      {done ? <Alert kind="success" title="Appointment moved." live /> : null}
      <Button
        disabled={!start}
        loading={pending}
        onClick={async () => {
          const result = await send(`/api/admin/appointments/${id}/reschedule`, "POST", { start, notifyPatient: notify });
          if (result.ok) {
            setDone(true);
            setSlots(null);
            setDate("");
            setStart("");
          }
        }}
      >
        Move appointment
      </Button>
    </div>
  );
}

export function NoteForm({ url }: { url: string }) {
  const { send, pending, error } = useAdminRequest();
  const [text, setText] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await send(url, url.includes("/enquiries/") ? "PATCH" : "POST", url.includes("/enquiries/") ? { note: text } : { text });
        if (result.ok) setText("");
      }}
    >
      <label className="grid gap-1 text-sm font-semibold">
        Add an internal note
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} required className="min-h-20 rounded-sm border border-steel-400 p-2 font-normal" />
      </label>
      {error ? <Alert kind="error" title={error.message} live /> : null}
      <Button type="submit" variant="secondary" loading={pending} disabled={!text.trim()}>
        Save note
      </Button>
    </form>
  );
}

export function RetryNotificationButton({ id }: { id: string }) {
  const { send, pending, error } = useAdminRequest();
  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="secondary" loading={pending} onClick={() => void send(`/api/admin/notifications/${id}/retry`, "POST")}>
        Retry now
      </Button>
      {error ? <span className="text-sm text-danger">{error.message}</span> : null}
    </span>
  );
}

export function statusLabel(status: AppointmentStatus): string {
  return STATUS_LABELS[status];
}
