import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Container({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-site px-4 md:px-6", className)} {...rest} />;
}

type SectionProps = ComponentProps<"section"> & { tone?: "light" | "white" | "dark" };

export function Section({ tone = "light", className, ...rest }: SectionProps) {
  const toneClass = tone === "dark" ? "surface-dark" : tone === "white" ? "bg-white" : "bg-paper-50";
  return <section className={cn(toneClass, "py-16 md:py-24", className)} {...rest} />;
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  id?: string;
  tone?: "light" | "dark";
  as?: "h1" | "h2";
  className?: string;
};

export function SectionHeading({ eyebrow, title, intro, id, tone = "light", as: Tag = "h2", className }: SectionHeadingProps) {
  const muted = tone === "dark" ? "text-silver-300" : "text-graphite-600";
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? <p className={cn("eyebrow mb-3", tone === "dark" ? "text-silver-300" : "text-graphite-500")}>{eyebrow}</p> : null}
      <Tag id={id} className={cn("font-display", Tag === "h1" ? "text-4xl md:text-6xl" : "text-3xl md:text-4xl")}>
        {title}
      </Tag>
      {intro ? <div className={cn("mt-4 text-lg", muted)}>{intro}</div> : null}
    </div>
  );
}

/** Check-mark device taken from the root stroke of the logo. */
export function CheckMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-5 shrink-0", className)} fill="none">
      <path d="M3 11.5 9.2 20 19 6.5h3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SilverRule({ className }: { className?: string }) {
  return <hr className={cn("rule-silver", className)} />;
}
