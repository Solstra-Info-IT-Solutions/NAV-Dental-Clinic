import { Plus } from "lucide-react";

import type { Faq } from "@/features/faq/content";

/**
 * Native <details> accordion: keyboard and screen-reader accessible with no
 * client JavaScript. Headings are part of each summary for page outline.
 */
export function FaqList({ faqs, headingLevel: H = "h3" }: { faqs: Faq[]; headingLevel?: "h2" | "h3" }) {
  return (
    <div className="divide-y divide-silver-200 border-y border-silver-200">
      {faqs.map((faq) => (
        <details key={faq.q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
            <H className="text-lg font-semibold">{faq.q}</H>
            <Plus aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-45" />
          </summary>
          <p className="pb-5 text-graphite-600">{faq.a}</p>
        </details>
      ))}
    </div>
  );
}
