import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmartDateInputProps {
  value: string; // dd/mm/yyyy
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

const autoCompleteOnBlur = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const currentYear = new Date().getFullYear();
  if (digits.length === 8) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }
  if (digits.length === 7) {
    // assume missing leading 0 on day: 1062026 -> 01/06/2026
    const d = '0' + digits[0];
    return `${d}/${digits.slice(1, 3)}/${digits.slice(3)}`;
  }
  if (digits.length === 6) {
    // ddmmyy -> ddmm/20yy
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/20${digits.slice(4)}`;
  }
  if (digits.length === 4) {
    // ddmm -> dd/mm/currentYear
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${currentYear}`;
  }
  if (digits.length === 3) {
    // dmm -> 0d/mm/currentYear
    return `0${digits[0]}/${digits.slice(1, 3)}/${currentYear}`;
  }
  return raw;
};

const parseDDMM = (v: string): Date | undefined => {
  const parts = v.split('/');
  if (parts.length !== 3 || parts[2].length !== 4) return undefined;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return undefined;
  const dt = new Date(y, m, d);
  if (dt.getDate() !== d || dt.getMonth() !== m || dt.getFullYear() !== y) return undefined;
  return dt;
};

export function SmartDateInput({ value, onChange, placeholder = 'dd/mm/aaaa', className }: SmartDateInputProps) {
  const [open, setOpen] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 8) v = v.slice(0, 8);
    if (v.length >= 5) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
    else if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    onChange(v);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const completed = autoCompleteOnBlur(e.target.value);
    if (completed !== e.target.value) onChange(completed);
  };

  const selected = parseDDMM(value);

  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={10}
        className="pr-10"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(o => !o)}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              if (d) {
                onChange(`${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`);
                setOpen(false);
              }
            }}
            initialFocus
            captionLayout="dropdown-buttons"
            fromYear={2000}
            toYear={2100}
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
