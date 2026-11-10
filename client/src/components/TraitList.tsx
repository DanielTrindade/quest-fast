/** A titled list of free lines: class features, species traits or feats. */
import { sectionTitle, sheetEmpty } from './layout-styles';
export function TraitList({ title, items, emptyText }: { title: string; items: readonly string[]; emptyText: string }) {
  return (
    <section className="grid min-w-0 content-start gap-2">
      <h3 className={sectionTitle}>{title}</h3>
      {items.length > 0 ? (
        <ul className="m-0 grid list-none gap-1 p-0">
          {items.map((item) => (
            <li key={item} className="rounded-control border border-border bg-background p-2 [overflow-wrap:anywhere]">{item}</li>
          ))}
        </ul>
      ) : (
        <p className={sheetEmpty}>{emptyText}</p>
      )}
    </section>
  );
}
