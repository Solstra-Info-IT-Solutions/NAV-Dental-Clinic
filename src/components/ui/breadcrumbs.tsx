import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { getDictionary } from "@/i18n";

export type Crumb = { href: string; label: string };

/** Visual breadcrumb trail. BreadcrumbList JSON-LD is added from the same data in Phase 7. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = getDictionary();
  const trail: Crumb[] = [{ href: "/", label: t.nav.home }, ...items];
  return (
    <nav aria-label={t.common.breadcrumb} className="text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-silver-300">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {last ? (
                <span aria-current="page" className="text-platinum-100">
                  {crumb.label}
                </span>
              ) : (
                <>
                  <Link href={crumb.href} className="hover:text-platinum-100 hover:underline">
                    {crumb.label}
                  </Link>
                  <ChevronRight aria-hidden="true" className="size-4" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
