import type { ReactNode } from "react";

import { MobileActionBar } from "./mobile-action-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Header, main landmark, footer and mobile action bar shared by public pages and the 404 page. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
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
