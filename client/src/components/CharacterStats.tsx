import { Heart, Shield } from '@phosphor-icons/react';

export function CharacterStats({ hp, ac, proficiency }: { hp: number; ac: number; proficiency: number }) {
  return <dl className="flex flex-wrap gap-6 border-y border-border py-4 [&_dd]:mt-1 [&_dd]:font-mono [&_dd]:text-h1 [&_dd]:font-medium [&_dd]:tabular-nums [&_dt]:flex [&_dt]:items-center [&_dt]:gap-1 [&_dt]:text-small [&_dt]:text-text-secondary">
    <div><dt><Heart size={16} aria-hidden="true" />HP</dt><dd>{hp}</dd></div>
    <div><dt><Shield size={16} aria-hidden="true" />CA</dt><dd>{ac}</dd></div>
    <div><dt>Proficiência</dt><dd>+{proficiency}</dd></div>
  </dl>;
}
