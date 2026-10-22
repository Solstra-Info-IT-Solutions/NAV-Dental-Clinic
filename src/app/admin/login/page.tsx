import type { Metadata } from "next";

import { LoginForm } from "@/components/admin/login-form";
import { LogoMark } from "@/components/layout/logo";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return (
    <main id="main-content" className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-14 w-auto text-ink-900" />
          <h1 className="mt-4 font-display text-2xl">NAV Dental Clinic</h1>
          <p className="mt-1 text-graphite-600">Staff sign-in</p>
        </div>
        <div className="rounded-md border border-silver-200 bg-white p-6 shadow-overlay">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-graphite-600">Accounts are created by the clinic owner. There is no public sign-up.</p>
      </div>
    </main>
  );
}
