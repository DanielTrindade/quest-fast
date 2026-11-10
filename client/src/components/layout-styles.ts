// Layout shared by screens, stories and a few components.
export const page = '@container min-w-0';
export const stack = 'grid gap-3';
export const dialogActions = 'mt-6 flex flex-wrap justify-end gap-2';
// The sheet editor needs room for two columns; the sheet itself for three.
export const dialogWide = 'w-[min(720px,calc(100vw-32px))]';
export const dialogSheet = 'w-[min(880px,calc(100vw-32px))]';
export const eyebrow = 'text-small text-text-muted';
export const sectionTitle = 'm-0 font-display text-h2 font-semibold';
export const sheetEmpty = 'm-0 text-small text-text-muted';
export const sectionHeading = 'mb-4 flex items-center justify-between gap-3 max-[479px]:flex-wrap [&>h2]:flex [&>h2]:items-center [&>h2]:gap-2 [&>h2]:text-h2 [&>h2]:font-medium [&>span]:font-mono [&>span]:text-small [&>span]:text-text-muted';
export const memberRow = 'flex min-w-0 flex-wrap items-center gap-3 border-border py-4 not-first:border-t';
