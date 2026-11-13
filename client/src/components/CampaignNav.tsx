import type { MouseEvent } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { cn } from '../lib/utils';
import { Tooltip, TooltipProvider } from './Tooltip';

export type NavItem = {
  id: string; label: string; href: string;
  /** Shown in the phone tab bar, where the full label does not fit. */
  shortLabel?: string;
  icon?: Icon;
  /** Consecutive items with the same group are listed under one heading. */
  group?: string;
  /** Live state beside the label, such as the current combat round. */
  badge?: string;
};

function groupItems(items: NavItem[]) {
  const groups: { label?: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.label === item.group) last.items.push(item);
    else groups.push({ label: item.group, items: [item] });
  }
  return groups;
}

// Where the label is gone (collapsed rail, phone bar), the live badge shrinks to a dot on the icon.
const dot = 'after:absolute after:top-2 after:left-[calc(50%+var(--spacing-1))] after:size-2 after:rounded-full after:bg-success-text after:shadow-[0_0_0_2px_var(--color-surface-secret)] after:content-[""]';

const link = 'relative flex min-h-11 items-center gap-3 rounded-control px-3 whitespace-nowrap text-text-secondary no-underline transition-[background-color,color] duration-(--duration-quick) ease-settle hover:bg-card hover:text-foreground [&[aria-current]]:bg-card [&[aria-current]]:font-semibold [&[aria-current]]:text-foreground [&[aria-current]]:shadow-[inset_0_1px_0_var(--color-edge-light)] [&[aria-current]]:[&>svg]:text-accent-text';
const barLink = 'min-h-13 min-w-0 flex-[1_1_0] flex-col justify-center gap-1 px-0 py-1 text-micro text-text-muted [&[aria-current]]:bg-transparent [&[aria-current]]:text-accent-text [&[aria-current]]:shadow-none';
const badgeClass = 'ml-auto inline-flex items-center gap-1 font-mono text-micro font-semibold text-success-text before:size-1.5 before:rounded-full before:bg-success-text before:content-[""]';

function navClasses(item: NavItem, bar: boolean, collapsed: boolean) {
  const iconOnly = bar || collapsed;
  return {
    link: cn(link, bar && barLink, collapsed && 'justify-center px-0', item.badge && iconOnly && dot),
    label: cn('min-w-0 truncate', bar && 'max-w-full', collapsed && 'sr-only'),
    badge: cn(badgeClass, iconOnly && 'sr-only'),
    text: bar ? item.shortLabel ?? item.label : item.label,
  };
}

function NavLink({ item, active, variant, collapsed, onNavigate }: {
  item: NavItem; active: boolean; variant: 'list' | 'bar'; collapsed: boolean; onNavigate?: (href: string) => void;
}) {
  const Glyph = item.icon;
  const classes = navClasses(item, variant === 'bar', collapsed);
  const name = item.badge ? `${item.label}, ${item.badge}` : undefined;
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Modified clicks keep the browser's own behaviour (new tab, new window).
    if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(item.href);
  };
  const anchor = <a href={item.href} onClick={onClick} aria-current={active ? 'page' : undefined} aria-label={name} className={classes.link}>
    {Glyph && <Glyph size={20} aria-hidden="true" weight={active ? 'fill' : 'regular'} />}
    <span className={classes.label}>{classes.text}</span>
    {item.badge && <span className={classes.badge}>{item.badge}</span>}
  </a>;
  return <Tooltip label={name ?? item.label} disabled={!collapsed}>{anchor}</Tooltip>;
}

/**
 * The campaign navigation: one link per screen, the current one highlighted.
 * The active id and the navigation itself come from the consumer (the
 * router), so the nav stays presentational and works in the catalog.
 */
export function CampaignNav({ items, activeItem, ariaLabel, className, variant = 'list', collapsed = false, onNavigate }: {
  items: NavItem[];
  activeItem: string;
  ariaLabel: string;
  className?: string;
  variant?: 'list' | 'bar';
  collapsed?: boolean;
  onNavigate?: (href: string) => void;
}) {
  const bar = variant === 'bar';
  const groups = bar ? [{ label: undefined, items }] : groupItems(items);
  return (
    <TooltipProvider delayDuration={200}>
      <nav aria-label={ariaLabel} data-collapsed={collapsed || undefined}
        className={cn(bar ? 'flex flex-1' : 'mt-2 grid content-start gap-1', className)}>
        {groups.map((group) => (
          <div key={group.items[0].id} className={bar ? 'flex flex-1' : 'grid content-start gap-1 not-first:mt-3'}>
            {group.label && <span aria-hidden="true" className={cn('overflow-hidden px-3 text-micro whitespace-nowrap text-text-muted',
              collapsed && 'mx-2 h-px bg-border p-0 text-transparent')}>{group.label}</span>}
            {group.items.map((item) => (
              <NavLink key={item.id} item={item} active={activeItem === item.id} variant={variant} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>
    </TooltipProvider>
  );
}
