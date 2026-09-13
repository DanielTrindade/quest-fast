import type { NavItem } from './AppShell';

/**
 * The campaign navigation: anchor links with the current section highlighted.
 * The active id is provided by the consumer (see useActiveSection); the nav
 * stays presentational so it works in the shell and in the catalog.
 */
export function SectionNav({ items, activeItem, ariaLabel, className = '' }: {
  items: NavItem[];
  activeItem: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav className={className} aria-label={ariaLabel}>
      {items.map((item) => (
        // The items are sections of one page, so "location", not "page".
        <a key={item.id} href={item.href} aria-current={activeItem === item.id ? 'location' : undefined}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}