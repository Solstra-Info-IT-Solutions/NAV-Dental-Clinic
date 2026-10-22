import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileNav } from "@/components/layout/mobile-nav";
import { isActivePath, NavLinks } from "@/components/layout/nav-links";
import { ButtonLink } from "@/components/ui/button";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const items = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

function renderMobileNav() {
  return render(
    <MobileNav
      items={items}
      phoneHref="tel:+918006606001"
      phoneLabel="Call"
      bookLabel="Book"
      openLabel="Open menu"
      closeLabel="Close menu"
      navLabel="Main"
    />,
  );
}

beforeEach(() => {
  pathname.current = "/";
});

describe("isActivePath", () => {
  it("matches the home page exactly and sections by prefix", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/services", "/")).toBe(false);
    expect(isActivePath("/services/dental-consultation", "/services")).toBe(true);
    expect(isActivePath("/servicesx", "/services")).toBe(false);
  });
});

describe("NavLinks", () => {
  it("marks only the current section with aria-current", () => {
    pathname.current = "/services/dental-consultation";
    render(<NavLinks items={items} />);
    expect(screen.getByRole("link", { name: "Services" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
});

describe("MobileNav", () => {
  it("opens and closes the disclosure panel with the toggle", async () => {
    const user = userEvent.setup();
    renderMobileNav();
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Close menu");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the toggle", async () => {
    const user = userEvent.setup();
    renderMobileNav();
    const toggle = screen.getByRole("button", { name: "Open menu" });
    await user.click(toggle);
    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("links the call button to the clinic phone number", async () => {
    const user = userEvent.setup();
    renderMobileNav();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+918006606001");
    expect(screen.getByRole("link", { name: "Book" })).toHaveAttribute("href", "/appointment");
  });
});

describe("ButtonLink", () => {
  it("renders protocol links as plain anchors in the same tab", () => {
    render(<ButtonLink href="tel:+918006606001">Call</ButtonLink>);
    const link = screen.getByRole("link", { name: "Call" });
    expect(link).toHaveAttribute("href", "tel:+918006606001");
    expect(link).not.toHaveAttribute("target");
  });

  it("opens external links in a new tab with safe rel", () => {
    render(
      <ButtonLink href="https://wa.me/918006606001" external>
        WhatsApp
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "WhatsApp" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
