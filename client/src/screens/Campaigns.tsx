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
import { Skeleton } from '../components/Skeleton';
import { Surface } from '../components/Surface';
import { ApiError, api } from '../lib/api';
import { formatDate } from '../lib/format';
import { dialogActions, eyebrow, page, stack } from '../components/layout-styles';
import { cn } from '../lib/utils';

/** Visible copy stays in Portuguese — it is what the table reads. */
function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.';
}

function CreateCampaign() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () => api.createCampaign(name, description),
    onSuccess: () => {
      setOpen(false);
      setName('');
      setDescription('');
      // The list is the only cache this mutation makes stale.
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
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
        className={stack}
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Field
          label="Nome da campanha"
          error={create.isError ? errorMessage(create.error) : undefined}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          autoFocus
        />
        <Field
          label="Descrição"
          hint="Opcional. Uma linha para lembrar do que é esta mesa."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
        <div className={dialogActions}>
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

function JoinByCode() {
  const queryClient = useQueryClient();
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
      // The joined campaign has to appear in the list.
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
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
        className={stack}
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
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          autoFocus
        />
        <div className={dialogActions}>
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
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: api.campaigns });

  return (
    <main data-slot="page" className={cn(page, 'mx-auto w-full max-w-3xl p-4 sm:p-8')}>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-6 max-[479px]:gap-4 [&_h1]:mt-2 [&_h1]:font-display [&_h1]:text-display [&_h1]:font-semibold [&_h1]:tracking-[-0.04em] @max-[480px]:[&_h1]:text-h1">
        <div>
          <p className={eyebrow}>Suas mesas</p>
          <h1>Campanhas</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <JoinByCode />
          <CreateCampaign />
        </div>
      </header>

      {campaigns.isPending && (
        <Surface className={stack} aria-busy="true" aria-label="Carregando campanhas">
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
                <CreateCampaign />
                <JoinByCode />
              </div>
            }
          />
        </Surface>
      )}

      {campaigns.isSuccess && campaigns.data.campaigns.length > 0 && (
        <ul className={cn(stack, 'list-none p-0')}>
          {campaigns.data.campaigns.map((campaign) => (
            <li key={campaign.id}>
              {/* The whole card is the target: a link inside a surface makes
                  the surface look clickable while only the text is. */}
              <Link
                to="/campaigns/$campaignId"
                params={{ campaignId: campaign.id }}
                className="grid min-w-0 gap-1 rounded-panel border border-border bg-card p-4 text-foreground no-underline edge-raised transition-[background-color,border-color,transform] duration-(--duration-quick) ease-settle hover:border-border-strong hover:bg-muted motion-safe:active:scale-[0.99]"
              >
                <span className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-h2 font-semibold [overflow-wrap:anywhere]">{campaign.name}</span>
                  {/* Role and Badge share the same vocabulary, so no mapping. */}
                  <Badge role={campaign.role} />
                </span>
                {campaign.description && (
                  <span className="line-clamp-2 text-small text-text-secondary">{campaign.description}</span>
                )}
                <span className="text-micro text-text-muted">Entrou em {formatDate(campaign.joinedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
