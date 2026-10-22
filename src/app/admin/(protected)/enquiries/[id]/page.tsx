import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NoteForm } from "@/components/admin/appointment-actions";
import { EnquiryStatusForm } from "@/components/admin/enquiry-status-form";
import { AdminPageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { formatPhoneDisplay, telHref } from "@/features/clinic-settings/format";
import { ENQUIRY_CATEGORY_LABELS, type EnquiryCategory, type EnquiryStatus } from "@/features/enquiries/schemas";
import { getEnquiry } from "@/features/enquiries/service";
import { requireAdminPage } from "@/lib/auth/guards";
import { isAppError } from "@/lib/errors";
import { formatLocalDate, formatLocalTime } from "@/lib/time/ist";

export const metadata: Metadata = { title: "Enquiry" };

export default async function EnquiryDetailPage({ params }: PageProps<"/admin/enquiries/[id]">) {
  await requireAdminPage("staff");
  const { id } = await params;
  let e;
  try {
    e = await getEnquiry(id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/enquiries" className="underline">
          ← All enquiries
        </Link>
      </p>
      <AdminPageHeader title={e.name} description={<StatusBadge status={e.status} />} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Message">
          <dl className="mb-4 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold">Topic</dt>
            <dd>{ENQUIRY_CATEGORY_LABELS[e.category as EnquiryCategory]}</dd>
            <dt className="font-semibold">Received</dt>
            <dd>
              {formatLocalDate(e.createdAt)}, {formatLocalTime(e.createdAt)}
            </dd>
          </dl>
          <p className="whitespace-pre-wrap rounded-sm bg-paper-50 p-4">{e.message}</p>
          {e.status === "spam" && e.spamExpiresAt ? (
            <p className="mt-3 text-sm text-graphite-600">Marked as spam. It will be deleted on {formatLocalDate(e.spamExpiresAt)}.</p>
          ) : null}
        </Panel>
        <div className="space-y-6">
          <Panel title="Contact">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">Mobile</dt>
              <dd>
                <a href={telHref(e.phoneE164)} className="underline">
                  {formatPhoneDisplay(e.phoneE164)}
                </a>
              </dd>
              <dt className="font-semibold">Email</dt>
              <dd>{e.email ?? "Not given"}</dd>
            </dl>
          </Panel>
          <Panel title="Status">
            <EnquiryStatusForm id={String(e._id)} status={e.status as EnquiryStatus} />
          </Panel>
          <Panel title="Internal notes">
            <ul className="mb-4 space-y-3">
              {e.notes.map((n, i) => (
                <li key={i} className="rounded-sm bg-paper-50 p-3">
                  <p className="whitespace-pre-wrap">{n.text}</p>
                  <p className="mt-1 text-xs text-graphite-600">
                    {formatLocalDate(n.at)}, {formatLocalTime(n.at)}
                  </p>
                </li>
              ))}
            </ul>
            <NoteForm url={`/api/admin/enquiries/${String(e._id)}`} />
          </Panel>
        </div>
      </div>
    </>
  );
}
