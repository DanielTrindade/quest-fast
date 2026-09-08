import { useCallback, useId, useState } from 'react';
import { Check, Minus, Plus } from '@phosphor-icons/react';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Surface } from '../components/Surface';
import './foundations.css';

const COLOR_GROUPS = [
  { title: 'Superfícies', description: 'A profundidade vem das superfícies, sem sombras excessivas.', tokens: [
    ['surface', 'Fundo da aplicação'], ['surface-raised', 'Cards e painéis'],
    ['surface-overlay', 'Diálogos e popovers'], ['surface-secret', 'Conteúdo restrito ao mestre'],
  ] },
  { title: 'Texto e bordas', description: 'Hierarquia de leitura e limites de interação.', tokens: [
    ['text-primary', 'Títulos e conteúdo principal'], ['text-secondary', 'Descrições e apoio'],
    ['text-muted', 'Legendas e metadados'], ['border-subtle', 'Divisores discretos'],
    ['border-strong', 'Agrupamentos'], ['border-control', 'Limites dos campos'],
    ['focus-ring', 'Foco por teclado'],
  ] },
  { title: 'Ações e estados', description: 'Azul para agir. Vermelho para dano. Verde para cura.', tokens: [
    ['accent', 'Preenchimento de ação primária'], ['danger', 'Preenchimento de ação destrutiva'],
    ['success', 'Preenchimento de confirmação'], ['accent-fg', 'Texto sobre preenchimentos'],
    ['accent-text', 'Links e turno ativo'], ['danger-text', 'Dano e mensagens de erro'],
    ['success-text', 'Cura e confirmação'],
  ] },
] as const;

const TYPE_SCALE = [
  { token: 'display', spec: '32 / 36', sample: 'A arte de mestrar', className: 'font-display text-display font-semibold' },
  { token: 'h1', spec: '24 / 28', sample: 'Quem está jogando agora?', className: 'font-display text-h1 font-semibold' },
  { token: 'h2', spec: '18 / 24', sample: 'A próxima sessão', className: 'text-h2 font-medium' },
  { token: 'body', spec: '14 / 20', sample: 'A mesa conversa no Discord. Sua campanha, suas anotações e seus dados ficam aqui.', className: 'text-body text-text-secondary' },
  { token: 'small', spec: '13 / 18', sample: 'Metadados da ficha e horário da sessão.', className: 'text-small text-text-secondary' },
  { token: 'micro', spec: '11 / 16', sample: 'Atualizado há 5 minutos', className: 'text-micro text-text-muted' },
] as const;

const SECTIONS = [
  ['palette', 'Paleta'], ['typography', 'Tipografia'], ['geometry', 'Espaço e forma'],
  ['states', 'Estados'], ['accessibility', 'Contraste'],
] as const;
type SectionName = typeof SECTIONS[number][0];
type FoundationsProps = { section?: 'all' | SectionName };

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return NaN;
    // The CSS build shortens #ffffff to #fff. The measurement must accept both.
    const normalized = hex.length === 4 ? '#' + [...hex.slice(1)].map(char => char + char).join('') : hex;
    const [r, g, blue] = [1, 3, 5].map((start) => {
      const value = parseInt(normalized.slice(start, start + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * blue;
  };
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function Foundations({ section = 'all' }: FoundationsProps) {
  const id = useId();
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const styles = getComputedStyle(node);
    const next: Record<string, string> = {};
    for (const group of COLOR_GROUPS) {
      for (const [name] of group.tokens) {
        next[name] = styles.getPropertyValue('--color-' + name).trim();
      }
    }
    setResolved(next);
  }, []);
  const visible = (name: SectionName) => section === 'all' || section === name;
  const sectionId = (name: string) => id + '-' + name;
  const surfaces = ['surface', 'surface-raised', 'surface-overlay', 'surface-secret'];
  const contrastRows = [
    ...['text-primary', 'text-secondary', 'text-muted', 'accent-text', 'danger-text', 'success-text']
      .map((name) => ({
        label: name, against: 'menor razão nas 4 superfícies', target: 4.5,
        ratio: Math.min(...surfaces.map((surface) => contrast(resolved[name] ?? '', resolved[surface] ?? ''))),
      })),
    ...['accent', 'danger', 'success'].map((name) => ({
      label: 'accent-fg / ' + name, against: 'texto sobre preenchimento', target: 4.5,
      ratio: contrast(resolved['accent-fg'] ?? '', resolved[name] ?? ''),
    })),
    ...['focus-ring', 'border-control'].map((name) => ({
      label: name, against: 'menor razão nas 4 superfícies', target: 3,
      ratio: Math.min(...surfaces.map((surface) => contrast(resolved[name] ?? '', resolved[surface] ?? ''))),
    })),
  ];

  return (
    <div ref={measure} className="foundations">
      <header className="foundations__intro">
        <p className="foundations__brand">quest-fast</p>
        <h1>{section === 'all' ? 'Fundações do produto' : SECTIONS.find(([name]) => name === section)?.[1]}</h1>
        <p className="foundations__lead">Uma interface que deixa espaço para a campanha. Cor, tipografia e estados para acompanhar a mesa por horas.</p>
        <dl className="foundations__summary">
          <div><dt>Identidade</dt><dd>Neutros + azul lápis</dd></div>
          <div><dt>Ritmo</dt><dd>Base de 4px</dd></div>
          <div><dt>Leitura</dt><dd>Corpo em 14px</dd></div>
        </dl>
        {section === 'all' && <nav aria-label="Seções das fundações" className="foundations__nav">
          {SECTIONS.map(([name, label]) => <a key={name} href={'#' + sectionId(name)}>{label}</a>)}
        </nav>}
      </header>

      {visible('palette') && <section id={sectionId('palette')} aria-labelledby={sectionId('palette-title')} className="foundations__section">
        <h2 id={sectionId('palette-title')}>Cor com função</h2>
        <p className="foundations__description">Valores reais do tema. Use o token completo para manter laboratório e produto consistentes.</p>
        {COLOR_GROUPS.map((group) => <div className="token-group" key={group.title}>
          <h3>{group.title}</h3>
          <p className="foundations__description">{group.description}</p>
          <div className="token-grid">
            {group.tokens.map(([name, role]) => <div key={name} className="token-swatch">
              <span className="token-swatch__color" aria-hidden="true" style={{ backgroundColor: 'var(--color-' + name + ')' }} />
              <dl className="token-swatch__body">
                <dt><code>{'--color-' + name}</code></dt>
                <dd className="token-swatch__value">{resolved[name] || 'Lendo tema…'}</dd>
                <dd className="token-swatch__role">{role}</dd>
              </dl>
            </div>)}
          </div>
        </div>)}
      </section>}

      {visible('typography') && <section id={sectionId('typography')} aria-labelledby={sectionId('typography-title')} className="foundations__section">
        <h2 id={sectionId('typography-title')}>Uma hierarquia de leitura</h2>
        <p className="foundations__description">Space Grotesk nos títulos, Geist na interface e Geist Mono nos números. Três fontes carregadas localmente, com licença aberta.</p>
        <div className="type-specimens">{TYPE_SCALE.map((step) => <div key={step.token} className="type-specimen">
          <p className="type-specimen__meta"><code>{step.token}</code><span>{step.spec}px</span></p>
          <p className={step.className}>{step.sample}</p>
        </div>)}</div>
        <Surface className="number-specimen">
          <h3>Os números da mesa</h3>
          <p className="foundations__description">Geist Mono com numerais tabulares. Valores ilustrativos.</p>
          <dl className="number-grid">
            {[['HP', '34', 'de 42'], ['CA', '16', 'armadura'], ['Iniciativa', '13', 'na rodada'], ['d20', '+7', 'modificador']].map(([label, value, note]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd><dd className="number-grid__note">{note}</dd></div>
            ))}
          </dl>
          <div className="semantic-samples">
            <span className="text-danger-text"><Minus size={16} aria-hidden="true" /> Dano: 3 HP</span>
            <span className="text-success-text"><Plus size={16} aria-hidden="true" /> Cura: 5 HP</span>
          </div>
        </Surface>
      </section>}

      {visible('geometry') && <section id={sectionId('geometry')} aria-labelledby={sectionId('geometry-title')} className="foundations__section">
        <h2 id={sectionId('geometry-title')}>Espaço e forma</h2>
        <p className="foundations__description">Oito intervalos. Três raios, cada um com um papel definido.</p>
        <div className="spacing-specimens">
          {[[1, 4], [2, 8], [3, 12], [4, 16], [6, 24], [8, 32], [12, 48], [16, 64]].map(([token, px]) => (
            <div key={token} className="spacing-specimen">
              <code>{'--spacing-' + token}</code><span>{px}px</span>
              <span aria-hidden="true" className="spacing-specimen__bar" style={{ width: 'var(--spacing-' + token + ')' }} />
            </div>
          ))}
        </div>
        <div className="radius-specimens">
          {[['control', '6px', 'Botões, campos e chips'], ['panel', '10px', 'Cards, painéis e diálogos'], ['full', 'Circular', 'Avatares e badges']].map(([token, value, role]) => (
            <div key={token} className="radius-specimen">
              <span aria-hidden="true" style={{ borderRadius: 'var(--radius-' + token + ')' }} />
              <div><code>{'--radius-' + token}</code><p>{value}</p><p className="foundations__description">{role}</p></div>
            </div>
          ))}
        </div>
      </section>}

      {visible('states') && <section id={sectionId('states')} aria-labelledby={sectionId('states-title')} className="foundations__section">
        <h2 id={sectionId('states-title')}>Estados que orientam</h2>
        <p className="foundations__description">Componentes reais. Use Tab para conferir o foco e experimente editar os campos.</p>
        <h3>Ações</h3>
        <div className="action-specimens">
          <Button onClick={() => setSaved(true)}>{saved ? <Check size={16} aria-hidden="true" /> : null}Salvar campanha</Button>
          <Button variant="secondary" onClick={() => setSaved(false)}>Cancelar</Button>
          <Button variant="ghost" onClick={() => setSaved(true)}>Confirmar leitura</Button>
          <Button variant="danger" onClick={() => setSaved(false)}>Descartar rascunho</Button>
          <Button disabled>Indisponível</Button>
          <Button loading>Salvando…</Button>
        </div>
        <p role="status" className="state-feedback">{saved ? 'Exemplo salvo. Nenhum dado foi enviado.' : 'Exemplo local. As ações não alteram uma campanha.'}</p>
        <div className="field-specimens">
          <Field label="Nome da campanha" placeholder="Ex.: Ecos de Phandalin" hint="Escolha um nome que a mesa reconheça." />
          <Field label="Código de convite" defaultValue="ABC" error="O código deve ter 6 caracteres." aria-label="Código de convite com erro" />
          <Field label="Sistema de regras" defaultValue="D&D 5e" disabled hint="Este campo está indisponível neste exemplo." />
        </div>
        <h3>Conteúdo reservado</h3>
        <Surface variant="secret">
          <p>Edgar trai o grupo no capítulo 3.</p>
          <p className="foundations__description">Anotação ilustrativa do mestre. A restrição permanece reconhecível sem cor.</p>
        </Surface>
        <div className="state-specimens">
          <Surface>
            <h3>Nenhuma anotação ainda</h3>
            <p className="foundations__description">Registre uma pista ou um acontecimento para consultar na próxima sessão.</p>
            <Button variant="secondary" onClick={() => setSaved(true)}>Criar anotação</Button>
          </Surface>
          <Surface role="region" aria-busy="true" aria-label="Carregando anotações">
            <h3>Carregando anotações</h3>
            <div className="skeleton-specimen" aria-hidden="true">
              <div className="qf-skeleton" /><div className="qf-skeleton" /><div className="qf-skeleton" />
            </div>
            <p className="foundations__description">O espaço do conteúdo fica reservado.</p>
          </Surface>
        </div>
        <p className="foundations__description">Movimento: 80ms para pressionar, 140ms para alternar, 220ms para assentar. Com movimento reduzido, o estado aparece pronto.</p>
      </section>}

      {visible('accessibility') && <section id={sectionId('accessibility')} aria-labelledby={sectionId('accessibility-title')} className="foundations__section">
        <h2 id={sectionId('accessibility-title')}>Contraste verificável</h2>
        <p className="foundations__description">Cálculo a partir dos tokens resolvidos: 4,5:1 para texto e 3:1 para limites de controles e foco. Confira também o painel Accessibility.</p>
        <div className="contrast-specimens">{contrastRows.map((row) => <dl key={row.label} className="contrast-specimen">
          <dt><code>{row.label}</code><span>{row.against}</span></dt>
          <dd className={Number.isFinite(row.ratio) && row.ratio < row.target ? 'text-danger-text' : ''}>
            <strong>{Number.isFinite(row.ratio) ? row.ratio.toFixed(2).replace('.', ',') + ':1' : '…'}</strong>
            <span>{Number.isFinite(row.ratio) ? row.ratio >= row.target ? 'Atende' : 'Revisar' : 'Calculando'}</span>
          </dd>
        </dl>)}</div>
      </section>}
      <footer className="foundations__footer">Tokens compartilhados com o produto. Exemplos em português do Brasil.</footer>
    </div>
  );
}
