/** The header of the official sheet: who the character is, level and XP. */
export function SheetIdentity({ backgroundName, species, className, subclass, level, experience }: {
  /** The character's background ("Antecedente"). */
  backgroundName: string;
  species: string;
  className: string;
  subclass: string;
  level: number;
  experience: number;
}) {
  const cells: Array<[string, string]> = [
    ['Antecedente', backgroundName],
    ['Classe', className],
    ['Espécie', species],
    ['Subclasse', subclass],
  ];
  return (
    <div className="flex min-w-0 flex-wrap items-stretch gap-3">
      <dl className="m-0 grid flex-[1_1_260px] grid-cols-2 gap-x-4 gap-y-2 max-[479px]:grid-cols-1">
        {cells.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col-reverse gap-0.5 border-b border-border pb-1">
            <dt className="text-micro text-text-muted">{label}</dt>
            <dd className="m-0 font-semibold [overflow-wrap:anywhere]">{value || <span className="text-small font-normal text-text-muted">não informado</span>}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 grid min-w-22 content-center justify-items-center rounded-panel border border-border-strong bg-background px-3 py-2 text-center [&>span:not(:first-child)]:text-micro [&>span:not(:first-child)]:text-text-secondary">
        <span className="font-mono text-h1 font-semibold tabular-nums">{level}</span>
        <span>Nível</span>
        <span>{experience.toLocaleString('pt-BR')} XP</span>
      </p>
    </div>
  );
}
