"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout-primitives";

/** Segment error boundary: the header and footer stay usable around it. */
export default function PublicError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Production errors from Server Components only carry a digest, never internal details.
    console.error(error);
  }, [error]);

  return (
    <Container className="py-24 text-center md:py-32">
      <p className="eyebrow text-graphite-500">Something went wrong</p>
      <h1 className="mt-4 font-display text-4xl">This page could not be loaded</h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-graphite-600">
        Please try again. If the problem continues, call the clinic on +91 80066 06001.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="tel:+918006606001" variant="secondary">
          Call the clinic
        </ButtonLink>
      </div>
    </Container>
  );
}
