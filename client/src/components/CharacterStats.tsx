import { Heart, Shield } from '@phosphor-icons/react';

export function CharacterStats({ hp, ac, proficiency }: { hp: number; ac: number; proficiency: number }) {
  return <dl className="qf-character-stats">
    <div><dt><Heart size={16} aria-hidden="true" />HP</dt><dd>{hp}</dd></div>
    <div><dt><Shield size={16} aria-hidden="true" />CA</dt><dd>{ac}</dd></div>
    <div><dt>Proficiência</dt><dd>+{proficiency}</dd></div>
  </dl>;
}
