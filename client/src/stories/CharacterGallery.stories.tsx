import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { MyCharacter } from '@quest-fast/shared';
import { CharacterGallery } from '../components/CharacterGallery';
import { Button } from '../components/ui/button';
import { myCharacters, worstCase } from './fixtures/my-characters';

function Gallery({ characters, onOpen, onCreate }: {
  characters: MyCharacter[]; onOpen: (character: MyCharacter) => void; onCreate: () => void;
}) {
  const [selectedId, setSelectedId] = useState(characters[0].id);
  return (
    <CharacterGallery characters={characters} selectedId={selectedId} onSelect={setSelectedId} onOpen={onOpen} onCreate={onCreate}
      actions={(character) => character.active
        ? <Button size="sm">Ir para a mesa</Button>
        : <Button variant="secondary" size="sm">Ativar nesta campanha</Button>} />
  );
}

const meta = {
  title: 'Componentes/CharacterGallery',
  component: Gallery,
  args: { characters: myCharacters, onOpen: fn(), onCreate: fn() },
} satisfies Meta<typeof Gallery>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const Selecao: Story = {
  name: 'Seleção (largo) e cartas (estreito)',
  play: async ({ canvasElement }) => {
    const gallery = firstTheme(canvasElement);
    const roster = gallery.queryByRole('radiogroup', { name: 'Meus personagens' });
    // Narrow viewports show the cards instead of the row of portraits.
    if (!roster) return;
    const first = within(roster).getByRole('radio', { name: /Hazin Dan/ });
    await expect(first).toHaveAttribute('aria-checked', 'true');
    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(within(roster).getByRole('radio', { name: /Elara Sombravil/ })).toHaveAttribute('aria-checked', 'true');
    await expect(gallery.getByRole('heading', { name: 'Elara Sombravil' })).toBeVisible();
  },
};

export const Um: Story = {
  name: 'Um personagem',
  args: { characters: [myCharacters[0]] },
};

export const PiorCaso: Story = {
  name: 'Pior caso',
  args: { characters: [worstCase, ...myCharacters] },
};
