// The editors in dialogs (character sheet, statblock) share one layout.
export const form = 'grid grid-cols-[minmax(0,1fr)] gap-6 [&_[data-slot=tab-panel]]:gap-6';
// The tabs stay reachable while the long form scrolls inside the dialog.
export const formTabs = 'sticky top-[calc(var(--qf-dialog-pad)*-1)] z-2 -mx-(--qf-dialog-pad) bg-popover px-(--qf-dialog-pad) py-2';
export const fieldset = 'grid min-w-0 gap-4 rounded-panel border border-border p-4 [&>legend]:px-2 [&>legend]:font-semibold';
export const grid2 = 'grid grid-cols-2 gap-4 max-[479px]:grid-cols-1';
export const grid3 = 'grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-4';
export const abilitiesGrid = 'grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 max-[479px]:grid-cols-1';
export const legendNote = 'm-0 text-small text-text-muted';
export const formError = 'text-small text-danger-text';
// Groups the fields an import replaces, to close them while the PDF is read; no box of its own.
export const lock = 'contents';

export const checkChip = 'flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-border px-2 py-1 text-small text-text-secondary transition-[background-color,border-color,color] duration-(--duration-quick) has-checked:border-input has-checked:bg-card has-checked:text-foreground [&>input]:size-4 [&>input]:cursor-pointer [&>input]:accent-primary';

// Each attack is its own small card: the fields read as one attack, and the
// remove action sits in the header instead of floating beside an input.
export const itemCard = 'grid min-w-0 gap-2 rounded-control border border-border bg-card px-3 pt-2 pb-3 [&_[data-slot=input]]:bg-background [&_[data-slot=native-select]]:bg-background';
export const itemHead = 'flex items-center justify-between gap-2 text-small font-semibold text-text-secondary';
// Wraps by the card's own width: one line on a wide dialog, fewer per line
// when narrower. Top alignment keeps inputs level though only some have hints.
export const attackFields = 'flex flex-wrap items-start gap-3 [&>[data-slot=field]]:flex-[2_1_7rem] [&>[data-slot=field]:has(input[type=number])]:flex-[0_0_6rem]';
export const wideField = 'flex-[3_1_12rem]!';

export const fileButton = 'relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border border-input bg-card px-4 py-2 font-medium text-foreground edge-raised transition-[background-color,transform] duration-(--duration-quick) ease-settle hover:bg-muted motion-safe:active:scale-[0.97] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring aria-disabled:cursor-progress aria-disabled:opacity-60 [&>input]:sr-only';
