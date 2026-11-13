const graphemes = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

// "III" or "Jr." after a name is a generation, not a surname: never the last initial.
const SUFFIX = /^(?:[IVX]{2,}|Jr\.?|Sr\.?|Filho|Neto|Sobrinho)$/u;

function withoutSuffixes(words: string[]) {
  const kept = [...words];
  while (kept.length > 1 && SUFFIX.test(kept.at(-1)!)) kept.pop();
  return kept;
}

function firstGrapheme(text: string) {
  return graphemes.segment(text)[Symbol.iterator]().next().value?.segment ?? '';
}

/**
 * Up to two letters for an avatar or a campaign mark: the first and the last
 * word that start with a letter, so an emoji, a flag or a number ("Goblin 10")
 * never becomes half an initial. Scripts without case (Arabic, CJK) get a
 * single letter, since joining two of them can form a different word.
 */
export function initials(name: string, skip: (word: string) => boolean = () => false): string {
  const words = withoutSuffixes(name.trim().split(/\s+/u).filter(Boolean));
  const lettered = words.filter((word) => /^\p{L}/u.test(firstGrapheme(word)));
  const meaningful = lettered.filter((word) => !skip(word));
  const letters = (meaningful.length ? meaningful : lettered).map(firstGrapheme);
  if (letters.length === 0) return firstGrapheme(name.trim()) || '?';
  const caseless = letters.some((letter) => letter.toLocaleUpperCase('pt-BR') === letter.toLocaleLowerCase('pt-BR'));
  const picked = letters.length > 1 && !caseless ? [letters[0], letters.at(-1)] : [letters[0]];
  return picked.join('').toLocaleUpperCase('pt-BR');
}
