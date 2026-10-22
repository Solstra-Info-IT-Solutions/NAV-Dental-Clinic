"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";

import { CheckboxField, HoneypotField, InputField, SelectField, TextareaField } from "@/components/forms/fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { CheckMark } from "@/components/ui/layout-primitives";
import { bookingFormSchema, PRIVACY_POLICY_VERSION, type BookingFormInput, type BookingFormValues } from "@/features/appointments/schemas";
import { getJson, postJson, type ApiErrorPayload } from "@/lib/api/client";
import { cn } from "@/lib/cn";

type ServiceOption = { slug: string; title: string };
type DateOption = { date: string; available: boolean };
type SlotOption = { start: string; label: string };
type Suggestion = SlotOption & { date: string };
type Created = { reference: string; status: "pending" | "confirmed"; start: string; serviceTitle: string; emailWillBeSent: boolean };

type Props = { services: ServiceOption[]; phoneHref: string; phoneLabel: string };

type Load<T> = { state: "idle" } | { state: "loading" } | { state: "error"; message: string } | { state: "ready"; value: T };

/** Maps API field paths to form field names. */
const API_FIELD: Record<string, FieldPath<BookingFormInput>> = {
  "patient.name": "name",
  "patient.phone": "phone",
  "patient.email": "email",
  service: "service",
  start: "start",
  message: "message",
  privacyAcknowledged: "privacyAcknowledged",
};

/** Dates shown before "Show more dates" (keeps the list short on phones). */
const INITIAL_DATES = 12;

const FIELD_ORDER: FieldPath<BookingFormInput>[] = ["service", "date", "start", "name", "phone", "email", "message", "privacyAcknowledged"];

function formatDateChip(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const value = new Date(Date.UTC(y, m - 1, d));
  return {
    weekday: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(value),
    day: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(value),
    long: new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(value),
  };
}

function formatInstant(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    .format(d)
    .replace(/\s?(am|pm)$/i, (_, p: string) => ` ${p.toUpperCase()}`);
  return `${date} at ${time}`;
}

export function BookingForm({ services, phoneHref, phoneLabel }: Props) {
  const formId = useId();
  const [created, setCreated] = useState<Created | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dates, setDates] = useState<Load<DateOption[]>>({ state: "idle" });
  const [slots, setSlots] = useState<Load<SlotOption[]>>({ state: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const [showAllDates, setShowAllDates] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  // Anti-spam timing and duplicate-submission protection. Refs, not state: they never affect rendering.
  const formStartedAt = useRef(0);
  const idempotencyKey = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    reset,
    control,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<BookingFormInput, unknown, BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { service: services.length === 1 ? services[0].slug : "", date: "", start: "", name: "", phone: "", email: "", message: "", privacyAcknowledged: false, marketingOptIn: false, hp: "" },
    shouldFocusError: false,
  });

  const service = useWatch({ control, name: "service" });
  const date = useWatch({ control, name: "date" });
  const start = useWatch({ control, name: "start" });

  useEffect(() => {
    formStartedAt.current = Date.now();
  }, []);

  // Load bookable dates whenever the service changes.
  useEffect(() => {
    if (!service) return;
    const controller = new AbortController();
    let active = true;
    (async () => {
      setDates({ state: "loading" });
      const result = await getJson<{ dates: DateOption[] }>(`/api/public/available-dates?service=${encodeURIComponent(service)}&days=31`, controller.signal);
      if (!active) return;
      if (result.ok) setDates({ state: "ready", value: result.data.dates.filter((d) => d.available) });
      else setDates({ state: "error", message: result.error.message });
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [service, reloadKey]);

  // Load free times whenever the date changes (and after a conflict).
  useEffect(() => {
    if (!service || !date) return;
    const controller = new AbortController();
    let active = true;
    (async () => {
      setSlots({ state: "loading" });
      const result = await getJson<{ slots: SlotOption[] }>(
        `/api/public/slots?service=${encodeURIComponent(service)}&date=${encodeURIComponent(date)}`,
        controller.signal,
      );
      if (!active) return;
      if (result.ok) setSlots({ state: "ready", value: result.data.slots });
      else setSlots({ state: "error", message: result.error.message });
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [service, date, reloadKey]);

  useEffect(() => {
    if (created) successRef.current?.focus();
  }, [created]);

  const errorList = FIELD_ORDER.filter((f) => errors[f]?.message).map((f) => ({ field: f, message: String(errors[f]?.message) }));

  useEffect(() => {
    if (submitCount > 0 && errorList.length > 0) summaryRef.current?.focus();
    // Focus the summary once per submit attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);

  function chooseService(slug: string) {
    setValue("service", slug, { shouldValidate: submitCount > 0 });
    setValue("date", "");
    setValue("start", "");
    setSlots({ state: "idle" });
    setSuggestions([]);
    setShowAllDates(false);
  }

  function chooseDate(value: string) {
    setValue("date", value, { shouldValidate: submitCount > 0 });
    setValue("start", "");
    setSuggestions([]);
  }

  function chooseSuggestion(s: Suggestion) {
    setValue("date", s.date);
    setValue("start", s.start, { shouldValidate: true });
    setSuggestions([]);
    clearErrors("start");
  }

  function applyServerError(error: ApiErrorPayload) {
    if (error.code === "SLOT_UNAVAILABLE") {
      setValue("start", "");
      setError("start", { message: "That time has just been taken. Please choose another time." });
      setSuggestions(Array.isArray(error.alternatives) ? (error.alternatives as Suggestion[]) : []);
      setReloadKey((k) => k + 1);
      setSubmitError(error.message);
      return;
    }
    let mapped = false;
    for (const [apiField, message] of Object.entries(error.fields ?? {})) {
      const field = API_FIELD[apiField];
      if (field) {
        setError(field, { message });
        mapped = true;
      }
    }
    // The idempotency key is kept on every failure, so retrying can never create a second booking.
    setSubmitError(mapped ? "Please correct the highlighted fields." : error.message);
  }

  async function submit(values: BookingFormValues) {
    setSubmitError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    const result = await postJson<Created>("/api/public/appointments", {
      idempotencyKey: idempotencyKey.current,
      patient: { name: values.name, phone: values.phone, email: values.email },
      service: values.service,
      start: values.start,
      message: values.message,
      privacyAcknowledged: values.privacyAcknowledged,
      marketingOptIn: values.marketingOptIn,
      policyVersion: PRIVACY_POLICY_VERSION,
      hp: values.hp,
      formStartedAt: formStartedAt.current,
    });
    if (result.ok) {
      setCreated(result.data);
      return;
    }
    applyServerError(result.error);
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  function startAgain() {
    reset();
    idempotencyKey.current = null;
    formStartedAt.current = Date.now();
    setCreated(null);
    setSubmitError(null);
    setSuggestions([]);
    setReloadKey((k) => k + 1);
  }

  if (created) {
    const pending = created.status === "pending";
    return (
      <div className="rounded-md border border-ink-900 bg-white p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-ink-900 text-platinum-100">
            <CheckMark />
          </span>
          <h2 ref={successRef} tabIndex={-1} className="font-display text-2xl focus:outline-none md:text-3xl">
            {pending ? "Request received" : "Appointment booked"}
          </h2>
        </div>
        <div role="status" className="mt-6 space-y-4">
          <p className="text-lg">
            {pending
              ? "Thank you. This is not yet a confirmed appointment – the clinic will call you on the mobile number you gave to confirm the time."
              : "Thank you. Your appointment is booked."}
          </p>
          <dl className="grid gap-3 rounded-md bg-paper-50 p-5 sm:grid-cols-[auto_1fr] sm:gap-x-6">
            <dt className="font-semibold">Reference</dt>
            <dd className="font-mono text-xl tracking-wider" data-testid="booking-reference">
              {created.reference}
            </dd>
            <dt className="font-semibold">Visit</dt>
            <dd>{created.serviceTitle}</dd>
            <dt className="font-semibold">{pending ? "Requested time" : "Time"}</dt>
            <dd>{formatInstant(created.start)}</dd>
          </dl>
          <p className="text-graphite-600">Please keep your reference. You will need it, with your mobile number, to check your request online.</p>
          {created.emailWillBeSent ? <p className="text-graphite-600">We are also sending these details to your email address.</p> : null}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/appointment/status" variant="secondary">
            Check request status
          </ButtonLink>
          <ButtonLink href={phoneHref} variant="secondary">
            <Phone aria-hidden="true" className="size-4" />
            Call {phoneLabel}
          </ButtonLink>
          <Button variant="ghost" onClick={startAgain}>
            Make another request
          </Button>
        </div>
      </div>
    );
  }

  const selectedDate = date ? formatDateChip(date).long : null;

  return (
    <form id={formId} noValidate onSubmit={(event) => void handleSubmit(submit)(event)} className="space-y-10" aria-describedby={`${formId}-intro`}>
      <p id={`${formId}-intro`} className="text-graphite-600">
        All fields are required unless marked optional. The clinic will contact you to confirm your appointment.
      </p>

      {(submitError || errorList.length > 0) && (
        <div ref={summaryRef} tabIndex={-1} className="focus:outline-none">
          <Alert kind="error" title={submitError ?? "Please correct the following:"} live>
            {errorList.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {errorList.map((e) => (
                  <li key={e.field}>
                    <a href={`#${formId}-${e.field}`} className="underline">
                      {e.message}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        </div>
      )}

      {/* Step 1: visit type */}
      <fieldset className="space-y-4">
        <legend className="mb-4 text-xl font-semibold">1. Type of visit</legend>
        <SelectField
          id={`${formId}-service`}
          label="What is the visit for?"
          error={errors.service?.message}
          {...register("service", { onChange: (e: { target: { value: string } }) => chooseService(e.target.value) })}
        >
          <option value="">Choose a visit type</option>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title}
            </option>
          ))}
        </SelectField>
      </fieldset>

      {/* Step 2: date */}
      <fieldset className="space-y-4" aria-describedby={errors.date ? `${formId}-date-error` : undefined}>
        <legend className="mb-4 text-xl font-semibold">2. Choose a date</legend>
        <span id={`${formId}-date`} tabIndex={-1} />
        {!service ? (
          <p className="text-graphite-600">Choose a visit type first.</p>
        ) : dates.state === "loading" || dates.state === "idle" ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Loading dates" role="status">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : dates.state === "error" ? (
          <Alert kind="error" title="Dates could not be loaded">
            <p>{dates.message}</p>
            <Button variant="secondary" className="mt-3" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          </Alert>
        ) : dates.value.length === 0 ? (
          <EmptyState title="No online times are available right now" action={<ButtonLink href={phoneHref}>Call {phoneLabel}</ButtonLink>}>
            Please call the clinic and the team will help you find a time.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {(showAllDates ? dates.value : dates.value.slice(0, INITIAL_DATES)).map((d) => {
              const chip = formatDateChip(d.date);
              const checked = date === d.date;
              return (
                <label
                  key={d.date}
                  className={cn(
                    "flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-md border px-2 py-2 text-center has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink-900",
                    checked ? "border-ink-900 bg-ink-900 text-platinum-100" : "border-silver-200 bg-white hover:border-ink-900",
                  )}
                >
                  <input type="radio" name={`${formId}-date-choice`} value={d.date} checked={checked} onChange={() => chooseDate(d.date)} className="sr-only" />
                  <span className="text-xs font-semibold uppercase tracking-wide">{chip.weekday}</span>
                  <span className="font-semibold">{chip.day}</span>
                  <span className="sr-only">{chip.long}</span>
                </label>
              );
            })}
          </div>
        )}
        {dates.state === "ready" && dates.value.length > INITIAL_DATES && !showAllDates ? (
          <Button variant="secondary" onClick={() => setShowAllDates(true)}>
            Show more dates
          </Button>
        ) : null}
        {errors.date?.message ? (
          <p id={`${formId}-date-error`} className="text-sm font-medium text-danger">
            <span className="sr-only">Error: </span>
            {errors.date.message}
          </p>
        ) : null}
      </fieldset>

      {/* Step 3: time */}
      <fieldset className="space-y-4" aria-describedby={errors.start ? `${formId}-start-error` : undefined}>
        <legend className="mb-4 text-xl font-semibold">3. Choose a time{selectedDate ? ` on ${selectedDate}` : ""}</legend>
        <span id={`${formId}-start`} tabIndex={-1} />
        {suggestions.length > 0 ? (
          <div className="rounded-md border border-warning bg-white p-4">
            <p className="font-semibold">Other available times</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <li key={s.start}>
                  <Button variant="secondary" onClick={() => chooseSuggestion(s)}>
                    {formatDateChip(s.date).day}, {s.label}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!date ? (
          <p className="text-graphite-600">Choose a date to see available times.</p>
        ) : slots.state === "loading" || slots.state === "idle" ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="status" aria-label="Loading times">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : slots.state === "error" ? (
          <Alert kind="error" title="Times could not be loaded">
            <p>{slots.message}</p>
            <Button variant="secondary" className="mt-3" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          </Alert>
        ) : slots.value.length === 0 ? (
          <p className="text-graphite-600">No times are left on this date. Please choose another date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {slots.value.map((s) => {
              const checked = start === s.start;
              return (
                <label
                  key={s.start}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center justify-center rounded-md border px-2 font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink-900",
                    checked ? "border-ink-900 bg-ink-900 text-platinum-100" : "border-silver-200 bg-white hover:border-ink-900",
                  )}
                >
                  <input
                    type="radio"
                    name={`${formId}-time-choice`}
                    value={s.start}
                    checked={checked}
                    onChange={() => {
                      setValue("start", s.start, { shouldValidate: submitCount > 0 });
                      setSuggestions([]);
                    }}
                    className="sr-only"
                  />
                  {s.label}
                </label>
              );
            })}
          </div>
        )}
        {errors.start?.message ? (
          <p id={`${formId}-start-error`} className="text-sm font-medium text-danger">
            <span className="sr-only">Error: </span>
            {errors.start.message}
          </p>
        ) : null}
      </fieldset>

      {/* Step 4: details */}
      <fieldset className="space-y-5">
        <legend className="mb-4 text-xl font-semibold">4. Your details</legend>
        <InputField id={`${formId}-name`} label="Full name" autoComplete="name" error={errors.name?.message} {...register("name")} />
        <InputField
          id={`${formId}-phone`}
          label="Mobile number"
          hint="The clinic will call this number to confirm. 10-digit Indian mobile number."
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <InputField
          id={`${formId}-email`}
          label="Email address"
          optional
          hint="Only used to send you details of this appointment."
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <TextareaField
          id={`${formId}-message`}
          label="Anything the clinic should know?"
          optional
          hint="For example, if you are in pain. Please do not include detailed medical history. Maximum 500 characters."
          maxLength={500}
          error={errors.message?.message}
          {...register("message")}
        />
        <HoneypotField {...register("hp")} />
      </fieldset>

      {/* Step 5: consent */}
      <fieldset className="space-y-4">
        <legend className="mb-4 text-xl font-semibold">5. Privacy</legend>
        <CheckboxField
          id={`${formId}-privacyAcknowledged`}
          error={errors.privacyAcknowledged?.message}
          label={
            <>
              I have read the{" "}
              <Link href="/privacy-policy" target="_blank" className="font-medium text-ink-900 underline underline-offset-4">
                privacy notice<span className="sr-only"> (opens in a new tab)</span>
              </Link>{" "}
              and agree that the clinic may use my details to arrange this appointment.
            </>
          }
          {...register("privacyAcknowledged")}
        />
        <CheckboxField
          id={`${formId}-marketingOptIn`}
          label="Optional: I would like to receive occasional dental care reminders from the clinic."
          {...register("marketingOptIn")}
        />
      </fieldset>

      <div className="flex flex-col gap-4 border-t border-silver-200 pt-8 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" loading={isSubmitting}>
          <CalendarCheck aria-hidden="true" className="size-5" />
          {isSubmitting ? "Sending request…" : "Send appointment request"}
        </Button>
        <p className="text-sm text-graphite-600">Prefer to talk? Call {phoneLabel}.</p>
      </div>
    </form>
  );
}
