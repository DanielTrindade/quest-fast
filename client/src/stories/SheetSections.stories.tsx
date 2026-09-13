import type { Meta, StoryObj } from '@storybook/react-vite';
import { AttunedItems } from '../components/AttunedItems';
import { EquipmentTraining } from '../components/EquipmentTraining';
import { TraitList } from '../components/TraitList';
import { hazinDan, lyraVentoclaro } from './fixtures/characters';

/** Read-only sections of the sheet: training, feature lists and attuned items. */
function Sections({ character = hazinDan, empty = false }: { character?: typeof hazinDan; empty?: boolean }) {
  const pick = <T,>(value: T, blank: T) => (empty ? blank : value);
  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 640 }}>
      <EquipmentTraining armorTraining={pick(character.armorTraining, [])} weapons={pick(character.weaponProficiencies, '')}
        tools={pick(character.toolProficiencies, '')} />
      <TraitList title="Características de classe" items={pick(character.features, [])} emptyText="Nenhuma característica registrada." />
      <TraitList title="Traços de espécie" items={pick(character.speciesTraits, [])} emptyText="Nenhum traço registrado." />
      <AttunedItems items={pick(character.attunedItems, [])} />
    </div>
  );
}

const meta = { title: 'Componentes/SheetSections', component: Sections } satisfies Meta<typeof Sections>;
export default meta;
type Story = StoryObj<typeof meta>;

export const HazinDan: Story = {};
export const Conjuradora: Story = { args: { character: lyraVentoclaro } };
export const Vazias: Story = { args: { empty: true } };
