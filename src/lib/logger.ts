/**
 * Minimal structured logger. Emits one JSON object per line so hosting log
 * drains can parse it. Sensitive keys are redacted recursively and phone
 * numbers/emails must be masked by callers before logging (see maskPhone).
 */

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const REDACT_KEYS = /^(password|pass|token|secret|authorization|cookie|set-cookie|apikey|api_key|phone|phonee164|email|message|uri|mongodb_uri)$/i;

function serializeError(error: Error): Fields {
  return {
    name: error.name,
    message: error.message,
    // Stack traces stay in server logs only; never returned to clients.
    stack: error.stack?.split("\n").slice(0, 6).join("\n"),
    ...("code" in error ? { code: (error as { code: unknown }).code } : {}),
  };
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Fields = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = REDACT_KEYS.test(key) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** "+918006606001" → "+91******6001" */
export function maskPhone(e164: string): string {
  return e164.length > 7 ? `${e164.slice(0, 3)}${"*".repeat(e164.length - 7)}${e164.slice(-4)}` : "***";
}

/** "ratan@example.com" → "r***@example.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return domain ? `${local.slice(0, 1)}***@${domain}` : "***";
}

function write(level: Level, event: string, fields: Fields = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...(redact(fields) as Fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: Fields) => write("debug", event, fields),
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
