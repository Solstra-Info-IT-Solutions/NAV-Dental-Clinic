import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-sm border bg-white px-3 py-3 text-base text-ink-900 placeholder:text-steel-400 " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-900 aria-invalid:border-danger";

type FieldShellProps = { id: string; label: string; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode };

export function fieldDescribedBy(id: string, hint?: unknown, error?: unknown): string | undefined {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

/** Label, hint and error wiring shared by all inputs (WCAG: visible label, programmatic error). */
export function FieldShell({ id, label, hint, error, optional, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-semibold">
        {label}
        {optional ? <span className="ml-1 font-normal text-graphite-500">(optional)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-graphite-600">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputFieldProps = Omit<ComponentProps<"input">, "id"> & { id: string; label: string; hint?: ReactNode; error?: string; optional?: boolean };

export function InputField({ id, label, hint, error, optional, className, ...rest }: InputFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, hint, error)}
        className={cn(control, error ? "border-danger" : "border-steel-400", className)}
        {...rest}
      />
    </FieldShell>
  );
}

type TextareaFieldProps = Omit<ComponentProps<"textarea">, "id"> & { id: string; label: string; hint?: ReactNode; error?: string; optional?: boolean };

export function TextareaField({ id, label, hint, error, optional, className, ...rest }: TextareaFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, hint, error)}
        className={cn(control, "min-h-28", error ? "border-danger" : "border-steel-400", className)}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectFieldProps = Omit<ComponentProps<"select">, "id"> & { id: string; label: string; hint?: ReactNode; error?: string };

export function SelectField({ id, label, hint, error, className, children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, hint, error)}
        className={cn(control, error ? "border-danger" : "border-steel-400", className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

type CheckboxFieldProps = Omit<ComponentProps<"input">, "id" | "type"> & { id: string; label: ReactNode; error?: string };

export function CheckboxField({ id, label, error, ...rest }: CheckboxFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 size-5 shrink-0 accent-ink-900"
          {...rest}
        />
        <label htmlFor={id} className="text-graphite-600">
          {label}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Off-screen trap field. Real visitors never see or fill it; bots usually do. */
export function HoneypotField(props: ComponentProps<"input">) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor="website">Leave this field empty</label>
      <input id="website" type="text" tabIndex={-1} autoComplete="off" {...props} />
    </div>
  );
}
