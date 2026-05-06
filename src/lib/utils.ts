import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
