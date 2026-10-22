import type { ReactNode } from "react";

import { PageHero } from "@/components/layout/page-hero";
import { Alert } from "@/components/ui/feedback";
import { Container, Section } from "@/components/ui/layout-primitives";
import { Prose } from "@/components/ui/prose";

/** Shared frame for legal documents. Unapproved drafts show a visible notice. */
export function LegalPage({
  title,
  href,
  approved,
  children,
}: {
  title: string;
  href: string;
  approved: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <PageHero title={title} crumbs={[{ href, label: title }]} />
      <Section tone="white">
        <Container>
          {!approved ? (
            <Alert kind="warning" title="Draft for clinic review" className="mb-10 max-w-[68ch]">
              <p>This document is a draft and has not yet been approved by the clinic. It will be finalised before the website launches.</p>
            </Alert>
          ) : null}
          <Prose>{children}</Prose>
        </Container>
      </Section>
    </>
  );
}
