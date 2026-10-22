"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";

import { CheckboxField, HoneypotField, InputField, SelectField, TextareaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { CheckMark } from "@/components/ui/layout-primitives";
import {
  ENQUIRY_CATEGORIES,
  ENQUIRY_CATEGORY_LABELS,
  enquiryFormSchema,
  type EnquiryFormInput,
  type EnquiryFormValues,
} from "@/features/enquiries/schemas";
import { postJson } from "@/lib/api/client";

const FIELD_ORDER: FieldPath<EnquiryFormInput>[] = ["name", "phone", "email", "category", "message", "privacyAcknowledged"];

const DEFAULTS: EnquiryFormInput = { name: "", phone: "", email: "", category: "", message: "", privacyAcknowledged: false, hp: "" };

/** Contact enquiry form. Works entirely through the website; no email app is needed. */
export function ContactForm({ phoneLabel }: { phoneLabel: string }) {
  const id = useId();
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const formStartedAt = useRef(0);
  const idempotencyKey = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<EnquiryFormInput, unknown, EnquiryFormValues>({ resolver: zodResolver(enquiryFormSchema), defaultValues: DEFAULTS, shouldFocusError: false });

  useEffect(() => {
    formStartedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  const errorList = FIELD_ORDER.filter((f) => errors[f]?.message).map((f) => ({ field: f, message: String(errors[f]?.message) }));

  useEffect(() => {
    if (submitCount > 0 && errorList.length > 0) summaryRef.current?.focus();
    // Focus the summary once per submit attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);

  async function submit(values: EnquiryFormValues) {
    setSubmitError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    const result = await postJson<{ received: true }>("/api/public/enquiries", {
      idempotencyKey: idempotencyKey.current,
      name: values.name,
      phone: values.phone,
      email: values.email,
      category: values.category,
      message: values.message,
      privacyAcknowledged: values.privacyAcknowledged,
      hp: values.hp,
      formStartedAt: formStartedAt.current,
    });
    if (result.ok) {
      setSent(true);
      return;
    }
    let mapped = false;
    for (const [field, message] of Object.entries(result.error.fields ?? {})) {
      if ((FIELD_ORDER as string[]).includes(field)) {
        setError(field as FieldPath<EnquiryFormInput>, { message });
        mapped = true;
      }
    }
    // The idempotency key is kept, so retrying after an error cannot send the message twice.
    setSubmitError(mapped ? "Please correct the highlighted fields." : result.error.message);
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  function sendAnother() {
    reset(DEFAULTS);
    idempotencyKey.current = null;
    formStartedAt.current = Date.now();
    setSent(false);
  }

  if (sent) {
    return (
      <div className="rounded-md border border-ink-900 bg-white p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-ink-900 text-platinum-100">
            <CheckMark />
          </span>
          <h3 ref={successRef} tabIndex={-1} className="font-display text-2xl focus:outline-none">
            Message sent
          </h3>
        </div>
        <p role="status" className="mt-4 text-lg">
          Thank you. The clinic team will reply on the mobile number you gave. For anything urgent, please call {phoneLabel}.
        </p>
        <Button variant="ghost" className="mt-6" onClick={sendAnother}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(submit)(event)} className="relative space-y-5">
      <p className="text-graphite-600">All fields are required unless marked optional.</p>

      {(submitError || errorList.length > 0) && (
        <div ref={summaryRef} tabIndex={-1} className="focus:outline-none">
          <Alert kind="error" title={submitError ?? "Please correct the following:"} live>
            {errorList.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {errorList.map((e) => (
                  <li key={e.field}>
                    <a href={`#${id}-${e.field}`} className="underline">
                      {e.message}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <InputField id={`${id}-name`} label="Full name" autoComplete="name" error={errors.name?.message} {...register("name")} />
        <InputField
          id={`${id}-phone`}
          label="Mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />
      </div>
      <InputField
        id={`${id}-email`}
        label="Email address"
        optional
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <SelectField id={`${id}-category`} label="What is your enquiry about?" error={errors.category?.message} {...register("category")}>
        <option value="">Choose a topic</option>
        {ENQUIRY_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {ENQUIRY_CATEGORY_LABELS[c]}
          </option>
        ))}
      </SelectField>
      <TextareaField
        id={`${id}-message`}
        label="Your message"
        hint="Please do not include detailed medical history. Maximum 2000 characters."
        maxLength={2000}
        rows={5}
        error={errors.message?.message}
        {...register("message")}
      />
      <HoneypotField {...register("hp")} />
      <CheckboxField
        id={`${id}-privacyAcknowledged`}
        error={errors.privacyAcknowledged?.message}
        label={
          <>
            I have read the{" "}
            <Link href="/privacy-policy" target="_blank" className="font-medium text-ink-900 underline underline-offset-4">
              privacy notice<span className="sr-only"> (opens in a new tab)</span>
            </Link>{" "}
            and agree that the clinic may use my details to reply to this enquiry.
          </>
        }
        {...register("privacyAcknowledged")}
      />
      <Button type="submit" size="lg" loading={isSubmitting}>
        <Send aria-hidden="true" className="size-5" />
        {isSubmitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
