import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";
/** The surface the button sits on; dark brand bands invert the palette. */
type Tone = "light" | "dark";

type StyleProps = { variant?: Variant; size?: Size; tone?: Tone; className?: string };

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-[0.02em] whitespace-nowrap " +
  "transition-colors duration-200 ease-brand disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60";

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-base",
  lg: "min-h-13 px-7 text-base",
};

const variants: Record<Tone, Record<Variant, string>> = {
  light: {
    primary: "bg-ink-900 text-platinum-100 hover:bg-ink-700",
    secondary: "border border-ink-900 text-ink-900 hover:bg-ink-900/5",
    ghost: "text-ink-900 hover:bg-ink-900/5",
  },
  dark: {
    primary: "bg-platinum-100 text-ink-900 hover:bg-white",
    secondary: "border border-silver-300 text-platinum-100 hover:bg-white/10",
    ghost: "text-platinum-100 hover:bg-white/10",
  },
};

export function buttonClasses({ variant = "primary", size = "md", tone = "light", className }: StyleProps = {}): string {
  return cn(base, sizes[size], variants[tone][variant], className);
}

type ButtonProps = ComponentProps<"button"> & StyleProps & { loading?: boolean };

export function Button({ variant, size, tone, className, loading = false, disabled, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, tone, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = StyleProps & {
  href: string;
  children: ReactNode;
  /** External/protocol links (tel:, https://wa.me) render a plain <a>. */
  external?: boolean;
} & Omit<ComponentProps<"a">, "href" | "className" | "children">;

export function ButtonLink({ href, variant, size, tone, className, external, children, ...rest }: ButtonLinkProps) {
  const classes = buttonClasses({ variant, size, tone, className });
  const isProtocol = /^(tel:|mailto:)/.test(href);
  if (external || isProtocol) {
    const newTab = external && !isProtocol;
    return (
      <a href={href} className={classes} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {children}
    </Link>
  );
}
