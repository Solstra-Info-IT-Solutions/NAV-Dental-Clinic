"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined);
        router.replace("/admin/login");
        router.refresh();
      }}
      className={cn("inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-silver-200 hover:bg-white/10 hover:text-platinum-100", className)}
    >
      <LogOut aria-hidden="true" className="size-4" />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
