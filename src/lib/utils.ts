import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Apply BR phone mask (99) 99999-9999 while typing. Accepts any partial input. */
export function formatPhoneMask(raw: string | null | undefined): string {
  const d = (raw || '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** True when phone has 10 or 11 digits (BR landline/mobile). */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const d = phone.replace(/\D/g, '');
  return d.length === 10 || d.length === 11;
}

/** Open a WhatsApp conversation in a new tab. Strips non-digits and prefixes 55 if missing. */
export function openWhatsApp(phone: string | null | undefined, message?: string) {
  if (!phone) return;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return;
  if (digits.length <= 11) digits = '55' + digits;
  const url = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
