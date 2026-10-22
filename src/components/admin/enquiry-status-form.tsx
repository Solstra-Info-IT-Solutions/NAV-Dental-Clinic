"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import type { EnquiryStatus } from "@/features/enquiries/schemas";

import { useAdminRequest } from "./use-admin-request";

const OPTIONS: { value: EnquiryStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "spam", label: "Spam (deleted after 30 days)" },
];

export function EnquiryStatusForm({ id, status }: { id: string; status: EnquiryStatus }) {
  const { send, pending, error } = useAdminRequest();
  const [value, setValue] = useState<EnquiryStatus>(status);
  return (
    <div className="space-y-3">
      <label className="grid max-w-xs gap-1 text-sm font-semibold">
        Status
        <select value={value} onChange={(e) => setValue(e.target.value as EnquiryStatus)} className="min-h-11 rounded-sm border border-steel-400 bg-white px-3 font-normal">
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <Alert kind="error" title={error.message} live /> : null}
      <Button variant="secondary" loading={pending} disabled={value === status} onClick={() => void send(`/api/admin/enquiries/${id}`, "PATCH", { status: value })}>
        Update status
      </Button>
    </div>
  );
}
