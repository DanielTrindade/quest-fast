import { useState } from 'react';
import { Plus, SignIn } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '@quest-fast/shared';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Input } from '../components/Input';
import { Skeleton } from '../components/Skeleton';
import { Surface } from '../components/Surface';
import { ApiError, api } from '../lib/api';
import { formatDate } from '../lib/format';

/** Visible copy stays in Portuguese — it is what the table reads. */
function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

function CreateCampaign({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () => api.createCampaign(name, description),
    onSuccess: () => {
      setOpen(false);
      setName('');
      setDescription('');
      onCreated();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) create.reset();
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
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Nome da campanha" error={create.isError ? errorMessage(create.error) : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
        </Field>
        <Field label="Descrição" hint="Opcional. Uma linha para lembrar do que é esta mesa.">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </Field>
        <div className="qf-dialog__actions">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Criar campanha
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function JoinByCode({ onJoined }: { onJoined: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');

  // The same normalizer the server uses: the format error shows before sending.
  const normalized = normalizeInviteCode(code);
  const malformed = code.trim().length > 0 && !normalized;

  const join = useMutation({
    mutationFn: () => api.joinCampaign(code),
    onSuccess: () => {
      setOpen(false);
      setCode('');
      onJoined();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) join.reset();
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
        onSubmit={(event) => {
          event.preventDefault();
          join.mutate();
        }}
      >
        <Field
          label="Código de convite"
          hint={`${INVITE_CODE_LENGTH} caracteres, sem distinguir maiúsculas.`}
          error={
            malformed
              ? 'Código incompleto ou com caractere inválido.'
              : join.isError
                ? errorMessage(join.error)
                : undefined
          }
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            autoFocus
          />
        </Field>
        <div className="qf-dialog__actions">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={join.isPending} disabled={!normalized}>
            Entrar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function Campaigns() {
  const queryClient = useQueryClient();
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: api.campaigns });
  const reload = () => queryClient.invalidateQueries({ queryKey: ['campaigns'] });

  return (
    <main className="qf-page mx-auto w-full max-w-3xl p-4 sm:p-8">
      <header className="campaign-heading">
        <div>
          <p className="campaign-eyebrow">Suas mesas</p>
          <h1>Campanhas</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <JoinByCode onJoined={reload} />
          <CreateCampaign onCreated={reload} />
        </div>
      </header>

      {campaigns.isPending && (
        <Surface className="qf-stack" aria-busy="true" aria-label="Carregando campanhas">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} shape="panel" />
          ))}
        </Surface>
      )}

      {campaigns.isError && (
        <Surface>
          <p role="alert" className="text-body text-danger-text">
            {errorMessage(campaigns.error)}
          </p>
        </Surface>
      )}

      {campaigns.isSuccess && campaigns.data.campaigns.length === 0 && (
        <Surface>
          <EmptyState
            title="Nenhuma campanha ainda"
            description="Crie a sua mesa ou entre em uma com o código que o mestre enviou."
            action={
              <div className="flex flex-wrap gap-3">
                <CreateCampaign onCreated={reload} />
                <JoinByCode onJoined={reload} />
              </div>
            }
          />
        </Surface>
      )}

      {campaigns.isSuccess && campaigns.data.campaigns.length > 0 && (
        <ul className="qf-stack list-none p-0">
          {campaigns.data.campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Surface>
                <Link
                  to="/campaigns/$campaignId"
                  params={{ campaignId: campaign.id }}
                  className="flex flex-wrap items-center justify-between gap-3 no-underline"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-text-primary">{campaign.name}</span>
                    <span className="block text-small text-text-muted">
                      Entrou em {formatDate(campaign.joinedAt)}
                    </span>
                  </span>
                  {/* Role and Badge share the same vocabulary, so no mapping. */}
                  <Badge role={campaign.role} />
                </Link>
              </Surface>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
