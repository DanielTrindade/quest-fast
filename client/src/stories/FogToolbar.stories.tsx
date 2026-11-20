import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { applyFog, type FogOperation, type SceneFog } from '@quest-fast/shared';
import { FogToolbar } from '../components/FogToolbar';
import { MapCanvas } from '../components/MapCanvas';
import type { FogTool } from '../lib/fog-tool';
import { fogOn } from './fixtures/fog';
import { SYNTHETIC_MAP, alignedSceneGrid, syntheticMapUrl } from './fixtures/maps';
import { MASTER_ID, masterTokens } from './fixtures/tokens';

type Props = Parameters<typeof FogToolbar>[0];

/** The toolbar keeping its own choices, as the screen will, so the controls can be driven. */
function Stateful(props: Props) {
  const [tool, setTool] = useState<FogTool | null>(props.tool);
  const [enabled, setEnabled] = useState(props.enabled);
  const [playerView, setPlayerView] = useState(props.playerView);
  return (
    <FogToolbar {...props} tool={tool} enabled={enabled} playerView={playerView}
      onToolChange={(next) => { setTool(next); props.onToolChange(next); }}
      onEnabledChange={(next) => { setEnabled(next); props.onEnabledChange(next); }}
      onPlayerViewChange={(next) => { setPlayerView(next); props.onPlayerViewChange(next); }} />
  );
}

/** Beside the map it drives, as in the master's bar on the Mesa. */
function BesideTheMap(props: Props) {
  const [tool, setTool] = useState<FogTool | null>(props.tool);
  const [playerView, setPlayerView] = useState(props.playerView);
  const [fog, setFog] = useState<SceneFog>(fogOn);
  // Here the story stands in for the server, with the same rule.
  const apply = (operation: FogOperation) => {
    const result = applyFog(fog.revealed, operation, SYNTHETIC_MAP.width, SYNTHETIC_MAP.height);
    if ('revealed' in result) setFog({ ...fog, revealed: result.revealed });
  };
  return (
    <div className="grid gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="h-[360px] min-w-0">
        <MapCanvas imageUrl={syntheticMapUrl()} mapWidth={SYNTHETIC_MAP.width} mapHeight={SYNTHETIC_MAP.height} grid={alignedSceneGrid}
          label="Salão em ruínas" tokens={masterTokens()} viewerId={MASTER_ID} fog={fog} fogLook={playerView ? 'player' : 'master'}
          fogTool={tool} onFogShape={(operation) => apply(operation)} />
      </div>
      <FogToolbar {...props} tool={tool} enabled={fog.enabled} areas={fog.revealed.length} playerView={playerView}
        onToolChange={setTool} onPlayerViewChange={setPlayerView}
        onEnabledChange={(enabled) => setFog({ ...fog, enabled })}
        onWholeMap={(mode) => apply({ mode, shape: { kind: 'all' } })} />
    </div>
  );
}

const meta = {
  title: 'Componentes/FogToolbar',
  component: FogToolbar,
  args: {
    enabled: true,
    onEnabledChange: fn(),
    tool: null,
    onToolChange: fn(),
    areas: 3,
    onWholeMap: fn(),
    playerView: false,
    onPlayerViewChange: fn(),
  },
  render: (args) => <Stateful {...args} />,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
} satisfies Meta<typeof FogToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvasElement, args }) => {
    const bar = firstTheme(canvasElement);
    await expect(bar.getByText('3 áreas reveladas.')).toBeInTheDocument();
    await expect(bar.getByRole('radio', { name: 'Mover o mapa' })).toBeChecked();

    await userEvent.click(bar.getByRole('radio', { name: 'Retângulo' }));
    await expect(args.onToolChange).toHaveBeenLastCalledWith({ mode: 'reveal', shape: 'rect' });
    // The mode changes the tool in hand.
    await userEvent.click(bar.getByRole('radio', { name: 'Ocultar' }));
    await expect(args.onToolChange).toHaveBeenLastCalledWith({ mode: 'hide', shape: 'rect' });
    await userEvent.click(bar.getByRole('radio', { name: 'Polígono' }));
    await expect(args.onToolChange).toHaveBeenLastCalledWith({ mode: 'hide', shape: 'polygon' });
    await userEvent.click(bar.getByRole('radio', { name: 'Mover o mapa' }));
    await expect(args.onToolChange).toHaveBeenLastCalledWith(null);

    await userEvent.click(bar.getByRole('checkbox', { name: 'Ver como jogador' }));
    await expect(args.onPlayerViewChange).toHaveBeenCalledWith(true);
  },
};

/** The whole map is one confirmation away: cancelling sends nothing. */
export const RevelarTudo: Story = {
  name: 'Revelar e ocultar tudo',
  play: async ({ canvasElement, args }) => {
    const bar = firstTheme(canvasElement);
    await userEvent.click(bar.getByRole('button', { name: /Ocultar tudo/ }));
    const confirm = within(bar.getByRole('group', { name: 'Ocultar tudo' }));
    await expect(confirm.getByText(/some da tela dos jogadores/)).toBeVisible();
    await userEvent.click(confirm.getByRole('button', { name: 'Cancelar' }));
    await expect(args.onWholeMap).not.toHaveBeenCalled();

    await userEvent.click(bar.getByRole('button', { name: /Revelar tudo/ }));
    await userEvent.click(within(bar.getByRole('group', { name: 'Revelar tudo' })).getByRole('button', { name: 'Revelar o mapa' }));
    await expect(args.onWholeMap).toHaveBeenCalledWith('reveal');
  },
};

export const Desligado: Story = {
  args: { enabled: false, areas: 0 },
  play: async ({ canvasElement, args }) => {
    const bar = firstTheme(canvasElement);
    await expect(bar.getByText('Desligado: os jogadores veem o mapa inteiro.')).toBeInTheDocument();
    await expect(bar.getByText(/preparar a cena com o fog desligado/)).toBeInTheDocument();
    await userEvent.click(bar.getByRole('checkbox', { name: 'Fog ligado' }));
    await expect(args.onEnabledChange).toHaveBeenCalledWith(true);
  },
};

export const NadaRevelado: Story = {
  name: 'Nada revelado',
  args: { areas: 0, tool: { mode: 'reveal', shape: 'rect' } },
};

/** A change on its way: the toggle and the whole-map buttons wait; the server's refusal shows below. */
export const OcupadoComErro: Story = {
  name: 'Ocupado, com erro',
  args: { busy: true, error: 'Não foi possível aplicar essa forma ao fog. Tente desenhá-la de novo.' },
  play: async ({ canvasElement }) => {
    const bar = firstTheme(canvasElement);
    await expect(bar.getByRole('checkbox', { name: 'Fog ligado' })).toBeDisabled();
    await expect(bar.getByRole('button', { name: /Revelar tudo/ })).toBeDisabled();
    await expect(bar.getByRole('alert')).toHaveTextContent('Tente desenhá-la de novo');
  },
};

export const NoMapa: Story = {
  name: 'Ao lado do mapa',
  decorators: [(Story) => <Story />],
  render: (args) => <BesideTheMap {...args} />,
  play: async ({ canvasElement }) => {
    const theme = firstTheme(canvasElement);
    await userEvent.click(theme.getByRole('checkbox', { name: 'Ver como jogador' }));
    await expect(theme.getByText(/3 tokens no mapa\. Fog ligado, como os jogadores veem/)).toBeInTheDocument();
  },
};
