// Shared by the official sheet's pieces, so counters and stat tiles read as one set.
export const trackerPanel = 'grid min-w-0 content-start gap-2 rounded-panel border border-border-strong bg-background p-3';
export const trackerLabel = 'm-0 text-small text-text-secondary';

export const statGrid = 'm-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,124px),1fr))] gap-2';
export const statTile = 'grid min-w-0 grid-rows-[1fr_auto] justify-items-center gap-1 rounded-panel border border-border-strong bg-background px-3 py-2 text-center [&_dt]:text-small [&_dt]:text-text-secondary';
export const statValue = 'm-0 flex items-center justify-center font-mono text-h2 font-semibold tabular-nums [overflow-wrap:anywhere]';
export const statRoll = 'inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-control border border-input bg-card px-3 text-foreground edge-raised transition-[background-color,transform] duration-(--duration-quick) ease-settle hover:not-disabled:bg-muted motion-safe:active:not-disabled:scale-[0.97] disabled:cursor-not-allowed disabled:text-text-muted [&>svg]:text-text-muted';

export const sheetItem = 'grid min-w-0 gap-1 rounded-control border border-border bg-background px-3 py-2';

// A whole card that opens something: bestiary creatures, encounters.
export const cardRow = 'flex min-h-11 w-full cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-panel border border-border bg-card px-4 py-3 text-start text-foreground edge-raised transition-[background-color,border-color,transform] duration-(--duration-quick) ease-settle hover:border-border-strong hover:bg-muted motion-safe:active:scale-[0.99]';
export const cardRowTitle = 'font-display text-h2 font-semibold [overflow-wrap:anywhere]';
