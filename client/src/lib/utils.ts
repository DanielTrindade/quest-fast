import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Without the custom type scale, tailwind-merge reads text-small as a color
// and drops the text color that came before it.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['display', 'h1', 'h2', 'body', 'small', 'micro'] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
