import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  group?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  emptyMessage = "No results found.",
  className,
  disabled = false,
  allowClear = false,
  clearLabel = "None",
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const selectedOption = options.find((option) => option.value === value);

  // Group options if they have a group property
  const groupedOptions = React.useMemo(() => {
    const groups: Record<string, SearchableSelectOption[]> = {};
    const ungrouped: SearchableSelectOption[] = [];

    options.forEach((option) => {
      if (option.group) {
        if (!groups[option.group]) {
          groups[option.group] = [];
        }
        groups[option.group].push(option);
      } else {
        ungrouped.push(option);
      }
    });

    return { groups, ungrouped };
  }, [options]);

  const hasGroups = Object.keys(groupedOptions.groups).length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? (
              <span className="flex items-center gap-2">
                {selectedOption.label}
                {selectedOption.sublabel && (
                  <span className="text-muted-foreground text-xs">
                    ({selectedOption.sublabel})
                  </span>
                )}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder={`Search...`}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {allowClear && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onValueChange("");
                    setOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === "" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">{clearLabel}</span>
                </CommandItem>
              </CommandGroup>
            )}
            {hasGroups ? (
              <>
                {groupedOptions.ungrouped.length > 0 && (
                  <CommandGroup>
                    {groupedOptions.ungrouped.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={`${option.label} ${option.sublabel || ""}`}
                        onSelect={() => {
                          onValueChange(option.value);
                          setOpen(false);
                          setSearchQuery("");
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span>{option.label}</span>
                        {option.sublabel && (
                          <span className="ml-2 text-muted-foreground text-xs">
                            ({option.sublabel})
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {Object.entries(groupedOptions.groups).map(([groupName, groupOptions]) => (
                  <CommandGroup key={groupName} heading={groupName}>
                    {groupOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={`${option.label} ${option.sublabel || ""}`}
                        onSelect={() => {
                          onValueChange(option.value);
                          setOpen(false);
                          setSearchQuery("");
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span>{option.label}</span>
                        {option.sublabel && (
                          <span className="ml-2 text-muted-foreground text-xs">
                            ({option.sublabel})
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            ) : (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.sublabel || ""}`}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{option.label}</span>
                    {option.sublabel && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        ({option.sublabel})
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
