"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, UserRound } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CRM_FOCUS_RING,
  CRM_MENU,
  CRM_MENU_ITEM,
  CRM_SURFACES,
} from "../../_lib/crm-theme";
import { getInitials } from "../../_lib/formatters";
import { AvatarInitials } from "../shared/avatar-initials";
import type { WisproEmployee } from "@/lib/wispro-types";

const toTitleCase = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const employeePhone = (employee: WisproEmployee) =>
  employee.phone_mobile || employee.phone || null;

interface EmployeePickerProps {
  employees: WisproEmployee[];
  value: string;
  onChange: (employeeId: string) => void;
  disabled?: boolean;
}

export const EmployeePicker = ({
  employees,
  value,
  onChange,
  disabled = false,
}: EmployeePickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => employees.find((employee) => employee.id === value) || null,
    [employees, value],
  );
  const selectedName = selected ? toTitleCase(selected.name) : null;
  const selectedPhone = selected ? employeePhone(selected) : null;

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Seleccionar técnico"
          aria-expanded={open}
          className={cn(
            CRM_FOCUS_RING,
            CRM_SURFACES.input,
            "flex h-11 w-full items-center gap-2 px-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
          )}>
          {selected ? (
            <AvatarInitials name={selectedName || selected.name} size="sm" />
          ) : (
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ${CRM_SURFACES.card}`}
              aria-hidden="true">
              <UserRound className={`size-3.5 ${CRM_SURFACES.textMuted}`} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-medium ${CRM_SURFACES.textPrimary}`}>
              {selectedName || "Sin asignar"}
            </span>
            <span className={`block truncate text-[11px] ${CRM_SURFACES.textMuted}`}>
              {selectedPhone || "Opcional · todos los empleados Wispro"}
            </span>
          </span>
          <ChevronDown
            className={`size-4 shrink-0 ${CRM_SURFACES.textMuted}`}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(
          CRM_MENU,
          CRM_SURFACES.border,
          "z-[80] w-[var(--radix-popover-trigger-width)] p-0",
        )}>
        <Command className="bg-transparent">
          <CommandInput placeholder="Buscar técnico o teléfono..." />
          <CommandList className="max-h-64">
            <CommandEmpty className={`py-4 text-center text-sm ${CRM_SURFACES.textMuted}`}>
              Sin coincidencias
            </CommandEmpty>
            <CommandGroup heading="Técnicos">
              <CommandItem
                value="sin asignar"
                className={cn(
                  CRM_MENU_ITEM,
                  "data-[selected=true]:bg-crm-accent-muted data-[selected=true]:text-crm-accent-muted-foreground",
                )}
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}>
                <Check
                  className={cn("size-4", value ? "opacity-0" : "opacity-100")}
                  aria-hidden="true"
                />
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full ${CRM_SURFACES.card}`}
                  aria-hidden="true">
                  <UserRound className={`size-3.5 ${CRM_SURFACES.textMuted}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Sin asignar</span>
                  <span className={`block text-[11px] ${CRM_SURFACES.textMuted}`}>
                    Crear el ticket sin técnico
                  </span>
                </span>
              </CommandItem>
              {employees.map((employee) => {
                const name = toTitleCase(employee.name);
                const phone = employeePhone(employee);
                const isSelected = employee.id === value;
                return (
                  <CommandItem
                    key={employee.id}
                    value={`${employee.name} ${phone || ""} ${getInitials(name)}`}
                    className={cn(
                      CRM_MENU_ITEM,
                      "data-[selected=true]:bg-crm-accent-muted data-[selected=true]:text-crm-accent-muted-foreground",
                    )}
                    onSelect={() => {
                      onChange(employee.id);
                      setOpen(false);
                    }}>
                    <Check
                      className={cn("size-4", isSelected ? "opacity-100" : "opacity-0")}
                      aria-hidden="true"
                    />
                    <AvatarInitials name={name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{name}</span>
                      <span className={`block truncate text-[11px] ${CRM_SURFACES.textMuted}`}>
                        {phone || "Sin teléfono"}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
