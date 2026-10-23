import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StatblockForm } from '../components/StatblockForm';
import { goblin, npcSheetImport, wyrmDasCinzas } from './fixtures/statblocks';
import '../styles/campaign.css';

const pdf = new File(['%PDF-1.7'], 'Ficha_Capita_Brisa.pdf', { type: 'application/pdf' });

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
    // Typing scrolled the frame below the importer; the audit reads it from the top.
    region.querySelector('.qf-page')?.scrollTo(0, 0);
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

export const ImportandoNpc: Story = {
  name: 'Importando NPC',
  // A read that never ends holds the form in the reading state.
  args: { readSheet: () => new Promise(() => {}) },
  play: async ({ canvasElement, args }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const form = within(region);
      await userEvent.upload(form.getByLabelText('Importar PDF'), pdf);
      await expect(form.getByRole('textbox', { name: /^Nome/ })).toBeDisabled();
      await expect(form.getByRole('button', { name: 'Adicionar ao bestiário' })).toBeDisabled();
      await expect(form.getAllByText('Importando ficha…')).toHaveLength(2);
      await expect(form.getByRole('button', { name: 'Cancelar' })).toBeEnabled();

      // The submit handler is guarded too, not only the button.
      region.querySelector('form')?.requestSubmit();
      await expect(form.queryByText('Informe o nome da criatura.')).toBeNull();
    }
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const ImportacaoNpc: Story = {
  name: 'NPC importado com pontos para revisar',
  args: { readSheet: async () => npcSheetImport },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const form = within(region);
      await userEvent.upload(form.getByLabelText('Importar PDF'), pdf);
      await expect(await form.findByText(/Ficha importada com pontos para revisar/)).toBeVisible();
      await expect(form.getByRole('textbox', { name: /^Nome/ })).toHaveValue('Capitã Brisa');
      await expect(form.getByRole('textbox', { name: /^Tipo/ })).toHaveValue('Humana');
      await expect(form.getByRole('spinbutton', { name: /^CA/ })).toHaveValue(16);
      await expect(form.getByRole('textbox', { name: /^Fórmula de PV/ })).toHaveValue('3d10+6');
      await expect(form.getByRole('textbox', { name: /^Traços/ })).toHaveValue(expect.stringContaining('Classe: Guerreira 3 (Campeã)'));

      // The sheet's warning and the missing challenge rating are both listed.
      const warnings = form.getByRole('list', { name: 'Pontos para revisar' });
      await expect(warnings.children).toHaveLength(2);
      await expect(within(warnings).getByText(/não tem nível de desafio/)).toBeVisible();
      // The blank bonus is marked before any submit.
      await expect(form.getByRole('group', { name: 'Ataque 2' }).querySelector('[aria-invalid="true"]')).not.toBeNull();

      region.querySelector('.qf-page')?.scrollTo(0, 0);
    }
  },
};

export const PdfNaoOficial: Story = {
  name: 'PDF que não é a ficha oficial',
  args: { readSheet: async () => null },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const form = within(region);
      await userEvent.upload(form.getByLabelText('Importar PDF'), pdf);
      await expect(await form.findByRole('alert')).toHaveTextContent('Este PDF não é a ficha oficial de D&D 2024 em português.');
      await expect(form.getByRole('textbox', { name: /^Nome/ })).toHaveValue('');
    }
  },
};

export const EdicaoSemImportacao: Story = {
  name: 'Edição não oferece importação',
  args: { statblock: goblin },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await expect(within(region).queryByLabelText('Importar PDF')).toBeNull();
    }
  },
};
