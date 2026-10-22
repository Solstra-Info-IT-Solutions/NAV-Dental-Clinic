import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | NAV Dental Clinic Admin" },
  robots: { index: false, follow: false, nocache: true },
};

/** Root of /admin: never indexed. Protected pages add the authenticated shell in (protected)/layout. */
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="min-h-dvh bg-paper-50">{children}</div>;
}
