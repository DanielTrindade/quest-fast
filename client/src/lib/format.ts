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

/** "21:47" — enough to follow the order of a session. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return TIME_PARTS.format(date);
}
