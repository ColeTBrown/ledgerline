import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS, getTool } from "@/tools/registry";
import { ToolPlaceholder } from "@/components/calc/tool-placeholder";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/app/[tool]">): Promise<Metadata> {
  const { tool } = await params;
  return { title: getTool(tool)?.name ?? "Tool" };
}

export default async function ToolPage({ params }: PageProps<"/app/[tool]">) {
  const { tool: id } = await params;
  const tool = getTool(id);
  if (!tool) notFound();
  return <ToolPlaceholder toolId={tool.id} />;
}
