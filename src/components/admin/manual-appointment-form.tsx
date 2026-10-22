"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { InputField, SelectField, TextareaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

import { useAdminRequest } from "./use-admin-request";

type Slot = { start: string; label: string };

/** Staff booking for phone or walk-in patients. Uses the same slot-hold transaction as online bookings. */
export function ManualAppointmentForm({ services, today }: { services: { slug: string; title: string }[]; today: string }) {
  const router = useRouter();
  const { send, pending, error } = useAdminRequest();
  const idempotencyKey = useRef<string | null>(null);
  const [service, setService] = useState(services[0]?.slug ?? "");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [start, setStart] = useState("");

  async function loadSlots(nextService: string, nextDate: string) {
    setStart("");
    setSlots(null);
    setSlotError(null);
    if (!nextService || !nextDate) return;
    const response = await fetch(`/api/admin/slots?service=${encodeURIComponent(nextService)}&date=${nextDate}`);
    const json = await response.json().catch(() => null);
    if (response.ok && json?.data) setSlots(json.data.slots);
    else setSlotError(json?.error?.message ?? "Could not load times.");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    idempotencyKey.current ??= crypto.randomUUID();
    const result = await send<{ id: string; reference: string }>(
      "/api/admin/appointments",
      "POST",
      {
        idempotencyKey: idempotencyKey.current,
        service,
        start,
        patient: { name: form.get("name"), phone: form.get("phone"), email: form.get("email") || undefined },
        message: form.get("message") || undefined,
        source: form.get("source"),
        status: form.get("status"),
        notifyPatient: form.get("notifyPatient") === "on",
      },
      { refresh: false },
    );
    if (result.ok) router.push(`/admin/appointments/${result.data.id}`);
    else if (result.error.code === "SLOT_UNAVAILABLE") void loadSlots(service, date);
  }

  const fieldErrors = error?.fields ?? {};

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? <Alert kind="error" title={error.message} live /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          id="manual-service"
          label="Visit type"
          value={service}
          onChange={(e) => {
            setService(e.target.value);
            void loadSlots(e.target.value, date);
          }}
          error={fieldErrors.service}
        >
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title}
            </option>
          ))}
        </SelectField>
        <InputField
          id="manual-date"
          label="Date"
          type="date"
          min={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            void loadSlots(service, e.target.value);
          }}
          required
        />
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold">Time</legend>
        {!date ? <p className="text-sm text-graphite-600">Choose a date to see free times.</p> : null}
        {slotError ? <Alert kind="error" title={slotError} /> : null}
        {slots && slots.length === 0 ? <p className="text-sm text-graphite-600">No free times on this date (closed, fully booked or blocked).</p> : null}
        {slots && slots.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <label key={s.start} className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-ink-900 ${start === s.start ? "border-ink-900 bg-ink-900 text-platinum-100" : "border-silver-200 bg-white"}`}>
                <input type="radio" name="manual-time" value={s.start} checked={start === s.start} onChange={() => setStart(s.start)} className="sr-only" />
                {s.label}
              </label>
            ))}
          </div>
        ) : null}
        {fieldErrors.start ? <p className="mt-2 text-sm text-danger">{fieldErrors.start}</p> : null}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <InputField id="manual-name" name="name" label="Patient name" required error={fieldErrors["patient.name"]} />
        <InputField id="manual-phone" name="phone" label="Mobile number" type="tel" required error={fieldErrors["patient.phone"]} />
        <InputField id="manual-email" name="email" label="Email" type="email" optional error={fieldErrors["patient.email"]} />
        <SelectField id="manual-source" name="source" label="How did they book?" defaultValue="phone">
          <option value="phone">Phone call</option>
          <option value="admin">Walk-in / in person</option>
        </SelectField>
        <SelectField id="manual-status" name="status" label="Status" defaultValue="confirmed">
          <option value="confirmed">Confirmed (time agreed with the patient)</option>
          <option value="pending">Pending (still to confirm)</option>
        </SelectField>
      </div>
      <TextareaField id="manual-message" name="message" label="Reason for visit / note from patient" optional maxLength={500} error={fieldErrors.message} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="notifyPatient" className="size-4 accent-ink-900" />
        Email the patient a confirmation (if they gave an email and email is set up)
      </label>
      <p className="text-sm text-graphite-600">
        Only enter details the patient has agreed to share for this appointment. The patient is not signed up for reminders.
      </p>
      <Button type="submit" loading={pending} disabled={!start}>
        Create appointment
      </Button>
    </form>
  );
}
