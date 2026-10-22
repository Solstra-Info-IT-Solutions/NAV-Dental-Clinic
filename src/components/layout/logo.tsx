import { cn } from "@/lib/cn";

/**
 * PROVISIONAL flat tracing of the NAV tooth mark, hand-drawn from the supplied
 * 3D render (brand-assets/logo-original.webp). It is not the official master
 * artwork — replace the paths with the client's vector file when supplied
 * (docs/BRAND_ANALYSIS.md §6).
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="150 195 770 735"
      className={cn("shrink-0", className)}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {/* Crown */}
      <path d="M163 392C160 300 215 232 320 228C420 224 470 290 540 298C610 290 660 222 765 222C870 222 915 300 905 392L852 392C858 322 830 268 765 268C690 268 640 322 540 336C440 322 400 272 320 272C250 272 214 322 210 392Z" />
      {/* Left foot of the crown */}
      <path d="M200 382L398 392L200 402Z" />
      {/* Highlight swoosh */}
      <path d="M245 210C345 196 445 238 488 326C430 262 345 226 245 210Z" />
      {/* Root / check mark */}
      <path d="M210 660L266 660L352 862L560 666L596 666L368 914Q348 936 330 912Z" />
      {/* Check-mark tail */}
      <path d="M578 662L772 664L578 672Z" />
    </svg>
  );
}

type LogoProps = { tone?: "light" | "dark"; className?: string };

/** Mark + wordmark set in the brand fonts ("NAV" serif, "DENTAL CLINIC" geometric sans). */
export function Logo({ tone = "light", className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark className={cn("h-10 w-auto", tone === "dark" ? "text-silver-200" : "text-ink-900")} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-2xl font-semibold tracking-[0.12em]", tone === "dark" ? "text-platinum-100" : "text-ink-900")}>
          NAV
        </span>
        <span className={cn("mt-1 whitespace-nowrap text-[0.6875rem] font-semibold tracking-[0.22em]", tone === "dark" ? "text-silver-300" : "text-graphite-600")}>
          DENTAL CLINIC
        </span>
      </span>
    </span>
  );
}
