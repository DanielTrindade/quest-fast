import { useState } from 'react';
import { Plus, SignIn } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { TAMANHO_CODIGO_CONVITE, normalizarCodigoConvite } from '@quest-fast/shared';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Input } from '../components/Input';
import { Skeleton } from '../components/Skeleton';
import { Surface } from '../components/Surface';
import { ErroDaApi, api } from '../lib/api';
import { formatarData, papelParaBadge } from '../lib/papel';

function mensagemDoErro(erro: unknown) {
  return erro instanceof ErroDaApi ? erro.message : 'Algo deu errado. Tente novamente.';
}

function CriarCampanha({ aoCriar }: { aoCriar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');

  const criar = useMutation({
    mutationFn: () => api.criarCampanha(nome, descricao),
    onSuccess: () => {
      setAberto(false);
      setNome('');
      setDescricao('');
      aoCriar();
    },
  });

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        setAberto(proximo);
        if (!proximo) criar.reset();
      }}
      trigger={
        <Button>
          <Plus size={18} aria-hidden="true" />
          Criar campanha
        </Button>
      }
      title="Uma nova aventura"
      description="Você será o mestre desta campanha e receberá o código para convidar a mesa."
    >
      <form
        className="qf-stack"
        onSubmit={(evento) => {
          evento.preventDefault();
          criar.mutate();
        }}
      >
        <Field label="Nome da campanha" error={criar.isError ? mensagemDoErro(criar.error) : undefined}>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={80}
            required
            autoFocus
          />
        </Field>
        <Field label="Descrição" hint="Opcional. Uma linha para lembrar do que é esta mesa.">
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} />
        </Field>
        <div className="qf-dialog__actions">
          <Button variant="secondary" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={criar.isPending}>
            Criar campanha
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function EntrarPorCodigo({ aoEntrar }: { aoEntrar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState('');

  // O mesmo normalizador do servidor: o erro de formato aparece antes do envio.
  const normalizado = normalizarCodigoConvite(codigo);
  const formatoInvalido = codigo.trim().length > 0 && !normalizado;

  const entrar = useMutation({
    mutationFn: () => api.entrarNaCampanha(codigo),
    onSuccess: () => {
      setAberto(false);
      setCodigo('');
      aoEntrar();
    },
  });

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        setAberto(proximo);
        if (!proximo) entrar.reset();
      }}
      trigger={
        <Button variant="secondary">
          <SignIn size={18} aria-hidden="true" />
          Entrar com código
        </Button>
      }
      title="Entrar em uma campanha"
      description="Peça o código ao mestre da mesa."
    >
      <form
        className="qf-stack"
        onSubmit={(evento) => {
          evento.preventDefault();
          entrar.mutate();
        }}
      >
        <Field
          label="Código de convite"
          hint={`${TAMANHO_CODIGO_CONVITE} caracteres, sem distinguir maiúsculas.`}
          error={
            formatoInvalido
              ? 'Código incompleto ou com caractere inválido.'
              : entrar.isError
                ? mensagemDoErro(entrar.error)
                : undefined
          }
        >
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            autoFocus
          />
        </Field>
        <div className="qf-dialog__actions">
          <Button variant="secondary" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={entrar.isPending} disabled={!normalizado}>
            Entrar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function Campanhas() {
  const cliente = useQueryClient();
  const campanhas = useQuery({ queryKey: ['campanhas'], queryFn: api.campanhas });
  const recarregar = () => cliente.invalidateQueries({ queryKey: ['campanhas'] });

  return (
    <main className="qf-page mx-auto w-full max-w-3xl p-4 sm:p-8">
      <header className="campaign-heading">
        <div>
          <p className="campaign-eyebrow">Suas mesas</p>
          <h1>Campanhas</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <EntrarPorCodigo aoEntrar={recarregar} />
          <CriarCampanha aoCriar={recarregar} />
        </div>
      </header>

      {campanhas.isPending && (
        <Surface className="qf-stack" aria-busy="true" aria-label="Carregando campanhas">
          {[0, 1, 2].map((linha) => (
            <Skeleton key={linha} shape="panel" />
          ))}
        </Surface>
      )}

      {campanhas.isError && (
        <Surface>
          <p role="alert" className="text-body text-danger-text">
            {mensagemDoErro(campanhas.error)}
          </p>
        </Surface>
      )}

      {campanhas.isSuccess && campanhas.data.campanhas.length === 0 && (
        <Surface>
          <EmptyState
            title="Nenhuma campanha ainda"
            description="Crie a sua mesa ou entre em uma com o código que o mestre enviou."
            action={
              <div className="flex flex-wrap gap-3">
                <CriarCampanha aoCriar={recarregar} />
                <EntrarPorCodigo aoEntrar={recarregar} />
              </div>
            }
          />
        </Surface>
      )}

      {campanhas.isSuccess && campanhas.data.campanhas.length > 0 && (
        <ul className="qf-stack list-none p-0">
          {campanhas.data.campanhas.map((campanha) => (
            <li key={campanha.id}>
              <Surface>
                <Link
                  to="/campanhas/$campanhaId"
                  params={{ campanhaId: campanha.id }}
                  className="flex flex-wrap items-center justify-between gap-3 no-underline"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-text-primary">{campanha.nome}</span>
                    <span className="block text-small text-text-muted">
                      Entrou em {formatarData(campanha.entrouEm)}
                    </span>
                  </span>
                  <Badge role={papelParaBadge(campanha.papel)} />
                </Link>
              </Surface>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
