import { z } from "zod";

import { AppError, type FieldErrors } from "@/lib/errors";

/** Converts a ZodError into `{ "patient.phone": "message" }` field errors. */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    fields[path] ??= issue.message;
  }
  return fields;
}

/** Parses input or throws a 422 VALIDATION_FAILED AppError with field messages. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError("VALIDATION_FAILED", { fields: zodFieldErrors(result.error) });
  return result.data;
}
