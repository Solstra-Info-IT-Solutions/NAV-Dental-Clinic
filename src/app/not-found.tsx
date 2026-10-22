import type { Metadata } from "next";

import { PublicShell } from "@/components/layout/public-shell";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout-primitives";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <PublicShell>
      <Container className="py-24 text-center md:py-32">
        <p className="eyebrow text-graphite-500">Error 404</p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">Page not found</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-graphite-600">
          The page you are looking for does not exist or may have moved.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/">Go to the home page</ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Contact the clinic
          </ButtonLink>
        </div>
      </Container>
    </PublicShell>
  );
}
