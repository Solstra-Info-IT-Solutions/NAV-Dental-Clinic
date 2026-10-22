import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { ServiceContent } from "@/features/services/catalog";

export function ServiceCard({ service, headingLevel: H = "h3" }: { service: ServiceContent; headingLevel?: "h2" | "h3" }) {
  return (
    <article className="group relative flex h-full flex-col rounded-md border border-silver-200 bg-white p-6 transition-colors hover:border-ink-900">
      <H className="text-xl font-semibold">
        <Link href={`/services/${service.slug}`} className="after:absolute after:inset-0 after:content-['']">
          {service.title}
        </Link>
      </H>
      <p className="mt-3 flex-1 text-graphite-600">{service.summary}</p>
      <span aria-hidden="true" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
        Learn more <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </span>
    </article>
  );
}
