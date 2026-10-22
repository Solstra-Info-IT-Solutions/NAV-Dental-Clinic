import type { ReactNode } from "react";

import { MobileActionBar } from "./mobile-action-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Header, main landmark, footer and mobile action bar shared by public pages and the 404 page. */
export function PublicShell({ children }: { children: ReactNode }) {
  // Set only by scripts/with-db.ts when it runs the in-memory development database.
  const sampleData = process.env.NAV_DEV_SAMPLE_DATA === "1";
  return (
    <>
      {sampleData ? (
        <div role="note" className="bg-warning px-4 py-2 text-center text-sm font-semibold text-white">
          Development preview: opening hours and bookings are sample data, not the clinic&apos;s real details.
        </div>
      ) : null}
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
      {/* Spacer so the fixed mobile action bar never covers footer content. */}
      <div aria-hidden="true" className="h-14 lg:hidden" />
      <MobileActionBar />
    </>
  );
}
