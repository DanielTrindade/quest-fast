/** Current, temporary and maximum hit points, as words for assistive tech. */
export function hpLabel(current: number, max: number, temp = 0) {
  return `${current} de ${max} pontos de vida${temp > 0 ? `, mais ${temp} temporários` : ''}`;
}

/** Down at zero hit points: said in words too, so colour is never the only signal. */
export function isDown(current: number) {
  return current <= 0;
}
