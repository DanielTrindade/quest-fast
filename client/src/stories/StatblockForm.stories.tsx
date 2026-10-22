import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StatblockForm } from '../components/StatblockForm';
import { goblin, wyrmDasCinzas } from './fixtures/statblocks';
import '../styles/campaign.css';

const frameStyle: CSSProperties = {
  maxWidth: 760,
  maxHeight: 640,
  overflow: 'auto',
  padding: 24,
  background: 'var(--color-surface-overlay)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 10,
  '--qf-dialog-pad': '24px',
} as CSSProperties;

const meta = {
  title: 'Componentes/StatblockForm',
  component: StatblockForm,
  args: { statblock: null, onSubmit: fn(), onRequestClose: fn() },
  decorators: [(Story) => <div className="qf-page" style={frameStyle}><Story /></div>],
} satisfies Meta<typeof StatblockForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NovaCriatura: Story = { name: 'Nova criatura' };

export const Edicao: Story = { name: 'Edição (goblin)', args: { statblock: goblin } };

export const EdicaoCompleta: Story = { name: 'Edição (dragão)', args: { statblock: wyrmDasCinzas } };

export const Salvando: Story = { args: { statblock: goblin, pending: true } };

export const ErroAoSalvar: Story = {
  name: 'Erro ao salvar',
  args: { statblock: goblin, submitError: 'Não foi possível salvar. Verifique a conexão e tente de novo.' },
};

export const EnvioValido: Story = {
  name: 'Envio válido',
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const form = within(region);
    await userEvent.type(form.getByRole('textbox', { name: /^Nome/ }), 'Kobold');
    await userEvent.type(form.getByRole('spinbutton', { name: /^PV médio/ }), '5');
    await userEvent.type(form.getByRole('textbox', { name: /^Fórmula de PV/ }), '2d6-2');
    await userEvent.click(form.getByRole('button', { name: 'Adicionar ao bestiário' }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Kobold', hpAverage: 5, hpFormula: '2d6-2' }),
    );
  },
};

export const ErrosPorCampo: Story = {
  name: 'Erros por campo',
  play: async ({ canvasElement, args }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const form = within(region);
      await userEvent.type(form.getByRole('textbox', { name: /^Fórmula de PV/ }), 'muitos');
      await userEvent.click(form.getByRole('button', { name: 'Adicionar ao bestiário' }));
      await expect(form.getByText('Informe o nome da criatura.')).toBeVisible();
      await expect(form.getByText('Use uma expressão de dados (ex.: 2d8+2) ou deixe em branco.')).toBeVisible();
      await expect(form.getByRole('textbox', { name: /^Nome/ })).toHaveFocus();
    }
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const Descarte: Story = {
  name: 'Descartar alterações',
  args: { statblock: goblin },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const form = within(region);
    await userEvent.type(form.getByRole('textbox', { name: /^Nome/ }), ' Chefe');
    await userEvent.click(form.getByRole('button', { name: 'Cancelar' }));
    await expect(form.getByText('Há alterações que ainda não foram salvas.')).toBeVisible();
    await expect(args.onRequestClose).not.toHaveBeenCalled();
    await userEvent.click(form.getByRole('button', { name: 'Descartar alterações' }));
    await expect(args.onRequestClose).toHaveBeenCalled();
  },
};
