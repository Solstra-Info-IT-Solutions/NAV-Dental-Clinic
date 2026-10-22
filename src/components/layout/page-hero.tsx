import type { ReactNode } from "react";

import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/layout-primitives";

/** Dark title band for inner pages: breadcrumbs, H1 and a short intro. */
export function PageHero({ title, intro, crumbs, children }: { title: string; intro?: ReactNode; crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="surface-dark border-b border-ink-700">
      <Container className="py-12 md:py-16">
        <Breadcrumbs items={crumbs} />
        <h1 className="mt-6 max-w-3xl font-display text-4xl md:text-5xl">{title}</h1>
        {intro ? <div className="mt-4 max-w-2xl text-lg text-silver-300">{intro}</div> : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </Container>
    </div>
  );
}
