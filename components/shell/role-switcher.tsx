"use client";

import { ChevronsUpDown } from "lucide-react";
import { ROLE_IDS, ROLES, type RoleId } from "@/config/roles";
import { useSettings } from "@/lib/store/settings";
import { useAltKey } from "@/hooks/use-mod-key";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RoleSwitcher() {
  const role = useSettings((s) => s.role);
  const setRole = useSettings((s) => s.setRole);
  const alt = useAltKey();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-normal" aria-label="Switch workspace role">
          <span className="text-2xs tracking-wider text-subtle-foreground uppercase">Role</span>
          <span className="font-medium text-foreground">{ROLES[role].shortLabel}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as RoleId)}>
          {ROLE_IDS.map((id) => (
            <DropdownMenuRadioItem key={id} value={id} className="items-start">
              <div className="flex min-w-0 flex-col">
                <span>{ROLES[id].label}</span>
                <span className="truncate text-2xs text-muted-foreground">{ROLES[id].description}</span>
              </div>
              <DropdownMenuShortcut>
                {alt}
                {ROLES[id].shortcut}
              </DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
