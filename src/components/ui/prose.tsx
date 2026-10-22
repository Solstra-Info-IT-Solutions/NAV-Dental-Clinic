import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** Long-form text styles (legal pages, service details) without a typography plugin. */
export function Prose({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-[68ch] text-graphite-600",
        "[&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink-900 md:[&_h2]:text-3xl [&_h2:first-child]:mt-0",
        "[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink-900",
        "[&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6",
        "[&_a]:font-medium [&_a]:text-ink-900 [&_a]:underline [&_a]:underline-offset-4",
        "[&_strong]:font-semibold [&_strong]:text-ink-900",
        className,
      )}
      {...rest}
    />
  );
}
