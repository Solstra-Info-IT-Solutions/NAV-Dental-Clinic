"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { InputField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { statusLookupSchema } from "@/features/appointments/schemas";
import { PUBLIC_STATUS_TEXT, type AppointmentStatus } from "@/features/appointments/status-machine";
import { postJson } from "@/lib/api/client";

type Result = { reference: string; status: AppointmentStatus; serviceTitle: string; start: string };

function formatInstant(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

/** Reference + mobile number lookup. Shows only the status, visit type and time. */
export function StatusLookupForm() {
  const id = useId();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof statusLookupSchema>, unknown, z.output<typeof statusLookupSchema>>({
    resolver: zodResolver(statusLookupSchema),
    defaultValues: { reference: "", phone: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setResult(null);
    const response = await postJson<Result>("/api/public/appointments/status", values);
    if (response.ok) setResult(response.data);
    else setError(response.error.message);
  });

  return (
    <div className="space-y-8">
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <InputField
          id={`${id}-reference`}
          label="Booking reference"
          hint="Shown after you sent your request, e.g. NAV-K7Q2-M9XD-4T"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          error={errors.reference?.message}
          {...register("reference")}
        />
        <InputField
          id={`${id}-phone`}
          label="Mobile number used for the booking"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <Button type="submit" loading={isSubmitting}>
          Check status
        </Button>
      </form>

      <div aria-live="polite">
        {error ? <Alert kind="error" title={error} /> : null}
        {result ? (
          <div className="rounded-md border border-ink-900 bg-white p-6">
            <h2 className="text-xl font-semibold">Booking {result.reference}</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:gap-x-6">
              <dt className="font-semibold">Status</dt>
              <dd data-testid="booking-status">{PUBLIC_STATUS_TEXT[result.status]}</dd>
              <dt className="font-semibold">Visit</dt>
              <dd>{result.serviceTitle}</dd>
              <dt className="font-semibold">Time</dt>
              <dd>{formatInstant(result.start)}</dd>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}
