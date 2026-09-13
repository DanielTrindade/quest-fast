/** A titled list of free lines: class features, species traits or feats. */
export function TraitList({ title, items, emptyText }: { title: string; items: readonly string[]; emptyText: string }) {
  return (
    <section className="qf-traits">
      <h3 className="qf-section-title">{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="qf-sheet-empty">{emptyText}</p>
      )}
    </section>
  );
}
