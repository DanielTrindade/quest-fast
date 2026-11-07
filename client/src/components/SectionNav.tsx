import type { Icon } from '@phosphor-icons/react';
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

function NavLink({ item, active, variant, collapsed }: {
  item: NavItem; active: boolean; variant: 'list' | 'bar'; collapsed: boolean;
}) {
  const Glyph = item.icon;
  const label = variant === 'bar' ? item.shortLabel ?? item.label : item.label;
  // The items are sections of one page, so "location", not "page".
  const name = item.badge ? `${item.label}, ${item.badge}` : undefined;
  const link = <a href={item.href} className="qf-section-nav__item" aria-current={active ? 'location' : undefined} aria-label={name}>
    {Glyph && <Glyph size={20} aria-hidden="true" weight={active ? 'fill' : 'regular'} />}
    <span className="qf-section-nav__label">{label}</span>
    {item.badge && <span className="qf-section-nav__badge">{item.badge}</span>}
  </a>;
  return <Tooltip label={name ?? item.label} disabled={!collapsed}>{link}</Tooltip>;
}

/**
 * The campaign navigation: anchor links with the current section highlighted.
 * The active id is provided by the consumer (see useActiveSection); the nav
 * stays presentational so it works in the shell and in the catalog.
 */
export function SectionNav({ items, activeItem, ariaLabel, className = '', variant = 'list', collapsed = false }: {
  items: NavItem[];
  activeItem: string;
  ariaLabel: string;
  className?: string;
  variant?: 'list' | 'bar';
  collapsed?: boolean;
}) {
  const groups = variant === 'bar' ? [{ label: undefined, items }] : groupItems(items);
  return (
    <TooltipProvider delayDuration={200}>
      <nav className={`qf-section-nav qf-section-nav--${variant} ${className}`} aria-label={ariaLabel}
        data-collapsed={collapsed || undefined}>
        {groups.map((group) => (
          <div key={group.items[0].id} className="qf-section-nav__group">
            {group.label && <span className="qf-section-nav__heading" aria-hidden="true">{group.label}</span>}
            {group.items.map((item) => (
              <NavLink key={item.id} item={item} active={activeItem === item.id} variant={variant} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>
    </TooltipProvider>
  );
}
