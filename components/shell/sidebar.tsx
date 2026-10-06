"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { ROLES } from "@/config/roles";
import { groupTools, toolsForRole, type ToolMeta } from "@/tools/registry";
import { useSettings } from "@/lib/store/settings";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Sidebar() {
  const role = useSettings((s) => s.role);
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const pathname = usePathname();
  const groups = groupTools(toolsForRole(role));

  return (
    <nav
      aria-label="Tools"
      className={cn(
        "scrollbar-thin flex shrink-0 flex-col overflow-y-auto border-r border-border bg-surface transition-[width] duration-150",
        collapsed ? "w-12" : "w-56",
      )}
    >
      <div className={cn("px-3 pt-3 pb-2", collapsed && "sr-only")}>
        <div className="text-2xs tracking-wider text-subtle-foreground uppercase">Workspace</div>
        <div className="truncate text-sm font-medium">{ROLES[role].terminology.dashboardTitle}</div>
      </div>
      <ul className="px-1.5 pb-1">
        <NavItem
          href="/app"
          label="Dashboard"
          icon={LayoutDashboard}
          active={pathname === "/app"}
          collapsed={collapsed}
        />
      </ul>
      {groups.map(({ group, tools }) => (
        <div key={group} className="pb-1">
          <div
            className={cn(
              "px-3 pt-2.5 pb-1 text-2xs font-medium tracking-wider text-subtle-foreground uppercase",
              collapsed && "sr-only",
            )}
          >
            {group}
          </div>
          {collapsed && <div className="mx-3 my-1.5 h-px bg-border" aria-hidden />}
          <ul className="px-1.5">
            {tools.map((tool) => (
              <NavItem
                key={tool.id}
                href={`/app/${tool.id}`}
                label={tool.name}
                icon={tool.icon}
                active={pathname === `/app/${tool.id}`}
                collapsed={collapsed}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: ToolMeta["icon"];
  active: boolean;
  collapsed: boolean;
}) {
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "group relative flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
        active && "bg-surface-3 text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
      <Icon className={cn("size-3.5 shrink-0", active && "text-accent")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
  return (
    <li>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ) : (
        link
      )}
    </li>
  );
}
