import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiceFive, Users } from '@phosphor-icons/react';
import { AttackCard } from '../components/AttackCard';
import { CharacterStats } from '../components/CharacterStats';
import { expect, userEvent, within } from 'storybook/test';
import { AbilityCard } from '../components/AbilityCard';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { DiceResult } from '../components/DiceResult';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Surface } from '../components/Surface';

function Tabletop({ longName = false }: { longName?: boolean }) {
  const [result, setResult] = useState<{ label: string; bonus: number } | null>(null);
  const [note, setNote] = useState('A chave de cobre abre a passagem sob a torre.');
  return <div className="@container grid min-w-0 gap-6">
    <header><h1 className="font-display text-h1 font-semibold tracking-tight">Peças da mesa</h1><p className="mt-2 max-w-[60ch] text-text-secondary">Componentes reais em uma ficha ilustrativa. Experimente os atributos e a rolagem.</p></header>
    <div className="grid min-w-0 gap-6 @min-[880px]:grid-cols-[minmax(0,1fr)_300px]">
      <Surface variant="sheet" className="grid min-w-0 gap-6 @max-[360px]:p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name="Elara Sombravil" src="/portraits/elara-example.png" variant="character" size="lg" />
          <div className="min-w-0 flex-[1_1_160px]"><h2 className="font-display text-h1 font-semibold tracking-tight [overflow-wrap:anywhere]">{longName ? 'Elara Sombravil, guardiã dos caminhos esquecidos' : 'Elara Sombravil'}</h2><p className="my-1 text-text-secondary">Meio-elfa · Ladina de nível 3</p><span className="text-small text-text-muted">Personagem de Ana Beatriz</span></div>
        </div>
        <CharacterStats hp={24} ac={15} proficiency={2} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
          <AbilityCard label="Destreza" abbreviation="DES" score={18} modifier={4} saveBonus={6} proficient
            onCheck={() => setResult({ label: 'Teste de Destreza', bonus: 4 })} onSave={() => setResult({ label: 'Resistência de Destreza', bonus: 6 })} />
          <AbilityCard label="Sabedoria" abbreviation="SAB" score={8} modifier={-1} saveBonus={-1}
            onCheck={() => setResult({ label: 'Teste de Sabedoria', bonus: -1 })} onSave={() => setResult({ label: 'Resistência de Sabedoria', bonus: -1 })} />
        </div>
        <AttackCard name="Adaga" bonus={7} damage="1d4+4" onRoll={() => setResult({ label: 'Ataque com adaga', bonus: 7 })} />
      </Surface>
      <div className="grid min-w-0 content-start gap-4 @max-[360px]:[&_[data-slot=empty]]:p-2">
        {result ? <div role="status"><DiceResult label={result.label} total={14 + result.bonus} dice={[{ sides: 20, value: 14 }]} decomposition={`14 ${result.bonus >= 0 ? '+' : '−'} ${Math.abs(result.bonus)}`} /><p className="mt-2 text-small text-text-muted">Dado fixo em 14 para comparar os componentes.</p></div> : <Surface><EmptyState title="Sua próxima rolagem" description="Use um atributo ou role o ataque para ver o resultado de exemplo." icon={DiceFive} action={null} /></Surface>}
        <Surface variant="secret"><Field asTextarea label="Anotação do mestre" value={note} onChange={event => setNote(event.target.value)} /></Surface>
      </div>
    </div>
    <section className="grid gap-4 border-t border-border pt-4" aria-label="Ações e papéis">
      <div className="flex flex-wrap gap-3"><Badge role="master" /><Badge role="player" /></div>
      <div className="flex flex-wrap gap-3"><Button><Users size={18} aria-hidden="true" />Convidar jogadores</Button><Button variant="secondary">Editar ficha</Button><Button variant="ghost">Consultar diário</Button><Button variant="danger">Excluir anotação</Button></div>
    </section>
  </div>;
}
const meta = { title: 'Composições/Peças da mesa', component: Tabletop } satisfies Meta<typeof Tabletop>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = { name: 'Padrão' };
export const NomeLongo: Story = { name: 'Nome longo', args: { longName: true } };
export const Rolagem: Story = { play: async ({ canvasElement }) => {
  for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
    const canvas = within(region);
    await userEvent.click(canvas.getByRole('button', { name: 'Atacar com Adaga' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('14 + 7 = 21');
    await userEvent.click(canvas.getByRole('button', { name: 'Teste de Sabedoria' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('14 − 1 = 13');
  }
} };
