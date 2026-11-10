// `dateStyle` in pt-BR yields "08 de set. de 2026". The design system's
// composed screen defines "08 set. 2026", so the parts are assembled by hand.
const DATE_PARTS = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** Dates arrive as ISO 8601; the table reads "02 set. 2026". */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = Object.fromEntries(DATE_PARTS.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day} ${parts.month} ${parts.year}`;
}

const TIME_PARTS = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * When a feed event happened. Today reads "21:47"; an older page of the
 * history must not pass for tonight, so it carries "ontem" or the date.
 */
export function formatEventTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const time = TIME_PARTS.format(date);
  if (dayKey(date) === dayKey(now)) return time;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return `ontem, ${time}`;
  const parts = Object.fromEntries(DATE_PARTS.formatToParts(date).map((part) => [part.type, part.value]));
  const day = `${parts.day} ${parts.month}`;
  return `${date.getFullYear() === now.getFullYear() ? day : `${day} ${parts.year}`}, ${time}`;
}
