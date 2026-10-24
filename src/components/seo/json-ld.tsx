import { serializeJsonLd } from "@/lib/seo/structured-data";

/**
 * Inline structured data. The content is built by our own serializer from
 * typed objects (never user HTML), with "<" escaped, so this is the one
 * deliberate use of dangerouslySetInnerHTML (documented in SECURITY.md).
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
