// One look for every "pick one of a few" control: native radios, ARIA tabs and
// toggle buttons share the track and the raised thumb of TabsList.
export const segmentedGroup = 'm-0 flex w-fit max-w-full min-w-0 flex-wrap items-center gap-1 rounded-panel border border-border bg-surface-secret p-1';

const item = 'relative inline-flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-control px-3 text-small font-medium text-text-secondary transition-[color,background-color,box-shadow] duration-(--duration-quick) ease-settle hover:text-foreground';

export const segmentedRadio = `${item} has-checked:bg-card has-checked:text-foreground has-checked:edge-raised has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring has-disabled:cursor-not-allowed has-disabled:text-text-muted has-disabled:line-through has-disabled:hover:text-text-muted [&>input]:sr-only`;

export const segmentedTab = `${item} min-h-11 aria-selected:bg-card aria-selected:text-foreground aria-selected:edge-raised focus-visible:outline-offset-0`;

export const checkLabel = 'flex min-h-11 cursor-pointer items-center gap-2 text-text-secondary [&>input]:size-4 [&>input]:cursor-pointer [&>input]:accent-primary';
