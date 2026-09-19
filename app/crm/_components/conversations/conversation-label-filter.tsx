"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Label } from "../../_lib/types";

interface ConversationLabelFilterProps {
  labels: Label[];
  selectedLabelId: number | null;
  onLabelChange: (value: number | null) => void;
}

export const ConversationLabelFilter = ({
  labels,
  selectedLabelId,
  onLabelChange,
}: ConversationLabelFilterProps) => {
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
  const selectedLabel = useMemo(
    () => labels.find((label) => label.id === selectedLabelId) || null,
    [labels, selectedLabelId],
  );

  return (
    <Popover open={isLabelMenuOpen} onOpenChange={setIsLabelMenuOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Filtrar por etiqueta"
          className="h-9 w-full justify-between rounded-xl px-3 font-medium"
        >
          <span className="truncate">
            {selectedLabel
              ? `Etiqueta: ${selectedLabel.name}`
              : "Todas las etiquetas"}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Buscar etiqueta..." />
          <CommandList>
            <CommandEmpty>Sin coincidencias</CommandEmpty>
            <CommandGroup heading="Etiquetas">
              <CommandItem
                value="todas"
                onSelect={() => {
                  onLabelChange(null);
                  setIsLabelMenuOpen(false);
                }}>
                <Check
                  className={cn(
                    "size-4",
                    selectedLabelId === null ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden="true"
                />
                Todas las etiquetas
              </CommandItem>
              {labels.map((label) => (
                <CommandItem
                  key={label.id}
                  value={label.name}
                  onSelect={() => {
                    onLabelChange(label.id);
                    setIsLabelMenuOpen(false);
                  }}>
                  <Check
                    className={cn(
                      "size-4",
                      selectedLabelId === label.id ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                    aria-hidden="true"
                  />
                  {label.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
