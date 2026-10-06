import { Suspense, type ComponentType } from "react";
import { CompanySnapshot } from "@/components/tools/company/company-snapshot";
import { ToolPlaceholder } from "@/components/calc/tool-placeholder";

/** Built tool UIs by registry id. Tools not listed render the placeholder frame. */
const IMPLEMENTATIONS: Record<string, ComponentType> = {
  company: CompanySnapshot,
};

export function isToolBuilt(id: string): boolean {
  return id in IMPLEMENTATIONS;
}

/**
 * Render a tool by id. Wrapped in Suspense because tools may read URL search
 * params (useSearchParams).
 */
export function ToolRenderer({ id }: { id: string }) {
  const Impl = IMPLEMENTATIONS[id];
  if (!Impl) return <ToolPlaceholder toolId={id} />;
  return (
    <Suspense fallback={null}>
      <Impl />
    </Suspense>
  );
}
