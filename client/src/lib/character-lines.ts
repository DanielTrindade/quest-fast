/** "Bárbaro de nível 5": class and level as one plain phrase. */
export function classLine({ class: className, level }: { class: string; level: number }) {
  return className.trim() ? `${className} de nível ${level}` : `Nível ${level}`;
}
