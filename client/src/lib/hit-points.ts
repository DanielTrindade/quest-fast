/** Current, temporary and maximum hit points, as words for assistive tech. */
export function hpLabel(current: number, max: number, temp = 0) {
  return `${current} de ${max} pontos de vida${temp > 0 ? `, mais ${temp} temporários` : ''}`;
}
