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
    <div className="qf-identity">
      <dl className="qf-identity__grid">
        {cells.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || <span className="qf-identity__empty">não informado</span>}</dd>
          </div>
        ))}
      </dl>
      <p className="qf-identity__level">
        <span className="qf-identity__level-value">{level}</span>
        <span>Nível</span>
        <span className="qf-identity__xp">{experience.toLocaleString('pt-BR')} XP</span>
      </p>
    </div>
  );
}
