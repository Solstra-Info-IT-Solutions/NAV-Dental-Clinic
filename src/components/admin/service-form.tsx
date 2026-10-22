"use client";

import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { CheckboxField, InputField, TextareaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import type { AdminService } from "@/features/services/admin";

import { ConfirmButton } from "./confirm-button";
import { useAdminRequest } from "./use-admin-request";

type Section = { heading: string; body: string };
type Faq = { q: string; a: string };

const EMPTY: Omit<AdminService, "id" | "redirectFrom" | "updatedAt"> = {
  slug: "",
  title: "",
  summary: "",
  sections: [{ heading: "What it is", paragraphs: [""] }],
  faqs: [],
  durationMinutes: null,
  published: false,
  bookable: false,
  order: 50,
  seo: {},
};

/** Create or edit a service. Paragraphs are separated by a blank line; no HTML is stored. */
export function ServiceForm({ service }: { service?: AdminService }) {
  const router = useRouter();
  const initial = service ?? { ...EMPTY, id: "", redirectFrom: [], updatedAt: "" };
  const { send, pending, error } = useAdminRequest();
  const [sections, setSections] = useState<Section[]>(initial.sections.map((s) => ({ heading: s.heading, body: s.paragraphs.join("\n\n") })));
  const [faqs, setFaqs] = useState<Faq[]>(initial.faqs);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const f = new FormData(event.currentTarget);
    const duration = String(f.get("durationMinutes") ?? "").trim();
    const body = {
      slug: String(f.get("slug") ?? "").trim(),
      title: String(f.get("title") ?? "").trim(),
      summary: String(f.get("summary") ?? "").trim(),
      sections: sections
        .map((s) => ({ heading: s.heading.trim(), paragraphs: s.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) }))
        .filter((s) => s.heading || s.paragraphs.length),
      faqs: faqs.map((q) => ({ q: q.q.trim(), a: q.a.trim() })).filter((q) => q.q || q.a),
      durationMinutes: duration ? Number(duration) : null,
      published: f.get("published") === "on",
      bookable: f.get("bookable") === "on",
      order: Number(f.get("order") ?? 0),
      seo: { title: String(f.get("seoTitle") ?? "").trim() || undefined, description: String(f.get("seoDescription") ?? "").trim() || undefined },
    };
    const result = service
      ? await send<AdminService>(`/api/admin/services/${service.id}`, "PUT", body)
      : await send<AdminService>("/api/admin/services", "POST", body, { refresh: false });
    if (result.ok) {
      if (!service) router.push(`/admin/services/${result.data.id}`);
      else setSaved(true);
    }
  }

  const fieldErrors = Object.entries(error?.fields ?? {});

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {saved ? <Alert kind="success" title="Service saved. The public pages are updated." live /> : null}
      {error ? (
        <Alert kind="error" title={error.message} live>
          {fieldErrors.length ? (
            <ul className="list-disc pl-5">
              {fieldErrors.map(([k, v]) => (
                <li key={k}>
                  <span className="font-mono text-xs">{k}</span>: {v}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-4 rounded-md border border-silver-200 bg-white p-5 md:grid-cols-2">
        <InputField id="svc-title" name="title" label="Title" defaultValue={initial.title} required maxLength={80} />
        <InputField id="svc-slug" name="slug" label="Web address" hint="Lowercase words joined by hyphens, e.g. root-canal-treatment." defaultValue={initial.slug} required maxLength={60} />
        <div className="md:col-span-2">
          <TextareaField id="svc-summary" name="summary" label="Short summary" hint="Shown on cards and in search results. 10–200 characters." defaultValue={initial.summary} maxLength={200} />
        </div>
        <InputField id="svc-order" name="order" label="Display order" type="number" min={0} max={999} defaultValue={initial.order} />
        <InputField id="svc-duration" name="durationMinutes" label="Appointment length (minutes)" optional hint="Leave empty to use the standard appointment length." type="number" min={10} max={480} step={5} defaultValue={initial.durationMinutes ?? ""} />
        <CheckboxField id="svc-published" name="published" label="Published (visible on the website). Only publish services the clinic offers." defaultChecked={initial.published} />
        <CheckboxField id="svc-bookable" name="bookable" label="Can be chosen when booking online" defaultChecked={initial.bookable} />
        <InputField id="svc-seo-title" name="seoTitle" label="Search title" optional maxLength={60} defaultValue={initial.seo?.title} />
        <InputField id="svc-seo-desc" name="seoDescription" label="Search description" optional maxLength={160} defaultValue={initial.seo?.description} />
      </div>

      <fieldset className="space-y-4 rounded-md border border-silver-200 bg-white p-5">
        <legend className="px-1 text-lg font-semibold">Page sections</legend>
        <p className="text-sm text-graphite-600">General information only — no guarantees of results and no personal medical advice. Separate paragraphs with a blank line.</p>
        {sections.map((s, i) => (
          <div key={i} className="space-y-2 border-b border-silver-200 pb-4">
            <InputField id={`sec-${i}-h`} label={`Section ${i + 1} heading`} value={s.heading} onChange={(e) => setSections((all) => all.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)))} />
            <TextareaField id={`sec-${i}-b`} label={`Section ${i + 1} text`} rows={5} value={s.body} onChange={(e) => setSections((all) => all.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
            <button type="button" onClick={() => setSections((all) => all.filter((_, j) => j !== i))} className="inline-flex min-h-10 items-center gap-1 text-sm hover:underline">
              <Minus aria-hidden="true" className="size-4" /> Remove section {i + 1}
            </button>
          </div>
        ))}
        {sections.length < 8 ? (
          <Button variant="ghost" onClick={() => setSections((all) => [...all, { heading: "", body: "" }])}>
            <Plus aria-hidden="true" className="size-4" /> Add section
          </Button>
        ) : null}
      </fieldset>

      <fieldset className="space-y-4 rounded-md border border-silver-200 bg-white p-5">
        <legend className="px-1 text-lg font-semibold">Questions and answers</legend>
        {faqs.map((q, i) => (
          <div key={i} className="space-y-2 border-b border-silver-200 pb-4">
            <InputField id={`faq-${i}-q`} label={`Question ${i + 1}`} value={q.q} onChange={(e) => setFaqs((all) => all.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
            <TextareaField id={`faq-${i}-a`} label={`Answer ${i + 1}`} value={q.a} onChange={(e) => setFaqs((all) => all.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            <button type="button" onClick={() => setFaqs((all) => all.filter((_, j) => j !== i))} className="inline-flex min-h-10 items-center gap-1 text-sm hover:underline">
              <Minus aria-hidden="true" className="size-4" /> Remove question {i + 1}
            </button>
          </div>
        ))}
        {faqs.length < 10 ? (
          <Button variant="ghost" onClick={() => setFaqs((all) => [...all, { q: "", a: "" }])}>
            <Plus aria-hidden="true" className="size-4" /> Add question
          </Button>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={pending}>
          {service ? "Save service" : "Create service"}
        </Button>
        {service ? <DeleteServiceButton id={service.id} /> : null}
      </div>
    </form>
  );
}

function DeleteServiceButton({ id }: { id: string }) {
  const router = useRouter();
  const { send } = useAdminRequest();
  return (
    <ConfirmButton
      label="Delete service"
      title="Delete this service?"
      description="This cannot be undone. Services that already have appointments cannot be deleted; unpublish them instead."
      confirmLabel="Delete"
      danger
      onConfirm={async () => {
        const r = await send(`/api/admin/services/${id}`, "DELETE", undefined, { refresh: false });
        if (r.ok) {
          router.push("/admin/services");
          return;
        }
        return r.error.message;
      }}
    />
  );
}
