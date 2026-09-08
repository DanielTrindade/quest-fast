import type { Papel } from '@quest-fast/shared';

/**
 * A API fala `mestre`/`jogador`; o design system nomeia os papéis em inglês.
 * A tradução vive aqui, num lugar só.
 */
export function papelParaBadge(papel: Papel): 'master' | 'player' {
  return papel === 'mestre' ? 'master' : 'player';
}

// `dateStyle` em pt-BR produz "08 de set. de 2026". A tela composta do design
// system define "08 set. 2026", então as partes são montadas à mão.
const PARTES_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** Datas chegam em ISO 8601; a mesa lê "02 set. 2026". */
export function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  const partes = Object.fromEntries(
    PARTES_DATA.formatToParts(data).map((parte) => [parte.type, parte.value]),
  );
  return `${partes.day} ${partes.month} ${partes.year}`;
}
