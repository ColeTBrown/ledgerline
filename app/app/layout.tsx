import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Workstation" };

export default function WorkstationLayout({ children }: LayoutProps<"/app">) {
  return <AppShell>{children}</AppShell>;
}
