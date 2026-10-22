import { PublicShell } from "@/components/layout/public-shell";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <PublicShell>{children}</PublicShell>;
}
