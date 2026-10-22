"use client";

import { useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  label: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  variant?: "primary" | "secondary" | "ghost";
  danger?: boolean;
  disabled?: boolean;
  /** Return an error message to keep the dialog open, or nothing to close it. */
  onConfirm: (input: { note: string; notify: boolean }) => Promise<string | void>;
  withNote?: boolean;
  withNotify?: boolean;
};

/**
 * Accessible confirmation using the native <dialog> element (focus is trapped
 * and restored by the browser; Escape closes it).
 */
export function ConfirmButton({ label, title, description, confirmLabel, variant = "secondary", danger, disabled, onConfirm, withNote, withNotify }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);

  async function confirm() {
    setPending(true);
    setError(null);
    const result = await onConfirm({ note: note.trim(), notify });
    setPending(false);
    if (result) setError(result);
    else {
      dialogRef.current?.close();
      setNote("");
    }
  }

  return (
    <>
      <Button variant={variant} disabled={disabled} onClick={() => dialogRef.current?.showModal()} className={danger ? "border-danger text-danger" : undefined}>
        {label}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-md border border-silver-200 bg-white p-6 text-ink-900 shadow-overlay backdrop:bg-ink-950/50"
      >
        <h2 id={`${id}-title`} className="text-xl font-semibold">
          {title}
        </h2>
        <div id={`${id}-desc`} className="mt-2 text-graphite-600">
          {description}
        </div>
        {withNote ? (
          <label className="mt-4 grid gap-1 text-sm font-semibold">
            Note (optional, internal)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20 rounded-sm border border-steel-400 p-2 font-normal" />
          </label>
        ) : null}
        {withNotify ? (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-ink-900" />
            Email the patient (if they gave an email and email is set up)
          </label>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
            Go back
          </Button>
          <Button onClick={confirm} loading={pending} className={danger ? "bg-danger hover:bg-danger" : undefined}>
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
