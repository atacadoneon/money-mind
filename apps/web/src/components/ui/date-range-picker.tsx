"use client";

import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface Preset {
  label: string;
  getValue: () => DateRange;
}

const PRESETS: Preset[] = [
  { label: "Hoje", getValue: () => { const d = new Date(); return { from: d, to: d }; } },
  { label: "Ontem", getValue: () => { const d = subDays(new Date(), 1); return { from: d, to: d }; } },
  { label: "Últimos 7 dias", getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Últimos 30 dias", getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "Este mês", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Mês passado", getValue: () => { const last = subMonths(new Date(), 1); return { from: startOfMonth(last), to: endOfMonth(last) }; } },
  { label: "Últimos 90 dias", getValue: () => ({ from: subDays(new Date(), 89), to: new Date() }) },
  { label: "Este ano", getValue: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Selecionar período",
  className,
  align = "start"
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selecting, setSelecting] = React.useState<"from" | "to">("from");

  const fmt = (d: Date | null) => (d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "");

  const label = React.useMemo(() => {
    if (value.from && value.to) {
      const f = fmt(value.from);
      const t = fmt(value.to);
      return f === t ? f : `${f} — ${t}`;
    }
    if (value.from) return fmt(value.from);
    return "";
  }, [value]);

  const handleDayClick = (day: Date | undefined) => {
    if (!day) return;
    if (selecting === "from") {
      onChange({ from: day, to: null });
      setSelecting("to");
    } else {
      if (value.from && day < value.from) {
        onChange({ from: day, to: value.from });
      } else {
        onChange({ from: value.from, to: day });
      }
      setSelecting("from");
      setOpen(false);
    }
  };

  const handlePreset = (preset: Preset) => {
    onChange(preset.getValue());
    setSelecting("from");
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: null, to: null });
  };

  const selected = React.useMemo(() => {
    if (value.from && value.to) return { from: value.from, to: value.to };
    if (value.from) return { from: value.from, to: value.from };
    return undefined;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 justify-start text-left font-normal min-w-[200px]",
            !label && "text-muted-foreground",
            className
          )}
          aria-label={label || placeholder}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{label || placeholder}</span>
          {(value.from || value.to) && (
            <X
              className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
              aria-label="Limpar período"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex">
          {/* Presets */}
          <div className="flex flex-col border-r p-2 gap-0.5 min-w-[140px]">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Atalhos
            </p>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                className="rounded px-2 py-1.5 text-sm text-left hover:bg-muted transition-colors"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => {
                setSelecting("from");
              }}
              className="rounded px-2 py-1.5 text-sm text-left hover:bg-muted transition-colors text-muted-foreground"
            >
              Personalizado
            </button>
          </div>
          {/* Calendar */}
          <div className="p-2">
            <p className="px-2 pb-1 text-xs text-muted-foreground">
              {selecting === "from" ? "Selecione a data inicial" : "Selecione a data final"}
            </p>
            <Calendar
              mode="range"
              selected={selected}
              onDayClick={handleDayClick}
              numberOfMonths={2}
              locale={ptBR}
              className="rounded-md"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
