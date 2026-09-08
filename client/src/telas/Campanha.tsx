import { useState } from 'react';
import { Users } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { MembroDaCampanha } from '@quest-fast/shared';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { CopyField } from '../components/CopyField';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Surface } from '../components/Surface';
import { Toast } from '../components/Toast';
import { ErroDaApi, api } from '../lib/api';
import { formatarData, papelParaBadge } from '../lib/papel';
import '../styles/campanha.css';

function mensagemDoErro(erro: unknown) {
  return erro instanceof ErroDaApi ? erro.message : 'Algo deu errado. Tente novamente.';
}

function RemoverMembro({
  campanhaId,
  membro,
  aoRemover,
}: {
  campanhaId: string;
  membro: MembroDaCampanha;
  aoRemover: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const remover = useMutation({
    mutationFn: () => api.removerMembro(campanhaId, membro.id),
    onSuccess: () => {
      setAberto(false);
      aoRemover();
    },
  });

  return (
    <Dialog
      open={aberto}
      onOpenChange={setAberto}
      trigger={
        <Button variant="ghost" aria-label={`Remover ${membro.nome}`}>
          Remover
        </Button>
      }
      title={`Remover ${membro.nome}?`}
      description="Esta pessoa deixará de participar da campanha. Você poderá convidá-la novamente."
    >
      {remover.isError && (
        <p role="alert" className="text-small text-danger-text">
          {mensagemDoErro(remover.error)}
        </p>
      )}
      <div className="qf-dialog__actions">
        <Button variant="secondary" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
        <Button variant="danger" loading={remover.isPending} onClick={() => remover.mutate()}>
          Remover jogador
        </Button>
      </div>
    </Dialog>
  );
}

function SairDaCampanha({ campanhaId }: { campanhaId: string }) {
  const [aberto, setAberto] = useState(false);
  const navegar = useNavigate();
  const sair = useMutation({
    mutationFn: () => api.sairDaCampanha(campanhaId),
    onSuccess: () => navegar({ to: '/campanhas' }),
  });

  return (
    <Dialog
      open={aberto}
      onOpenChange={setAberto}
      trigger={<Button variant="ghost">Sair da campanha</Button>}
      title="Sair desta campanha?"
      description="Você perde o acesso ao conteúdo da mesa. Para voltar, precisará do código de convite."
    >
      {sair.isError && (
        <p role="alert" className="text-small text-danger-text">
          {mensagemDoErro(sair.error)}
        </p>
      )}
      <div className="qf-dialog__actions">
        <Button variant="secondary" onClick={() => setAberto(false)}>
          Ficar
        </Button>
        <Button variant="danger" loading={sair.isPending} onClick={() => sair.mutate()}>
          Sair da campanha
        </Button>
      </div>
    </Dialog>
  );
}

export function Campanha({ campanhaId }: { campanhaId: string }) {
  const cliente = useQueryClient();
  const [removido, setRemovido] = useState(false);

  const campanha = useQuery({
    queryKey: ['campanha', campanhaId],
    queryFn: () => api.campanha(campanhaId),
  });
  const membros = useQuery({
    queryKey: ['membros', campanhaId],
    queryFn: () => api.membros(campanhaId),
  });

  const aoRemover = () => {
    setRemovido(true);
    cliente.invalidateQueries({ queryKey: ['membros', campanhaId] });
  };

  if (campanha.isError) {
    return (
      <main className="qf-page mx-auto w-full max-w-3xl p-4 sm:p-8">
        <Surface>
          <p role="alert" className="text-body text-danger-text">
            {mensagemDoErro(campanha.error)}
          </p>
        </Surface>
      </main>
    );
  }

  const eMestre = campanha.data?.papel === 'mestre';

  return (
    <main className="qf-page mx-auto w-full max-w-6xl p-4 sm:p-8">
      <header className="campaign-heading">
        <div className="min-w-0">
          <p className="campaign-eyebrow">Sua mesa</p>
          <h1>{campanha.data?.nome ?? 'Carregando…'}</h1>
          {campanha.data?.descricao && <p className="campaign-description">{campanha.data.descricao}</p>}
        </div>
        {!campanha.isPending && !eMestre && <SairDaCampanha campanhaId={campanhaId} />}
      </header>

      <div className="campaign-layout">
        <section className="campaign-members" aria-labelledby="titulo-membros">
          <div className="campaign-section-heading">
            <h2 id="titulo-membros">
              <Users size={20} aria-hidden="true" />
              Membros
            </h2>
            <span>
              {membros.isSuccess ? `${membros.data.membros.length} na mesa` : 'Carregando…'}
            </span>
          </div>

          <Surface className="campaign-roster">
            {membros.isPending && (
              <div className="qf-stack" role="region" aria-label="Carregando membros" aria-busy="true">
                {[0, 1, 2].map((linha) => (
                  <div key={linha} className="qf-member">
                    <Skeleton shape="avatar" />
                    <div className="qf-stack">
                      <Skeleton width="60%" />
                      <Skeleton width="80%" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {membros.isError && (
              <p role="alert" className="text-body text-danger-text">
                {mensagemDoErro(membros.error)}
              </p>
            )}

            {membros.isSuccess && (
              <ul>
                {membros.data.membros.map((membro) => (
                  <li key={membro.id} className="qf-member">
                    <Avatar name={membro.nome} src={membro.avatarUrl ?? undefined} />
                    <div className="campaign-member-info">
                      <span className="campaign-member-name">{membro.nome}</span>
                      <span className="campaign-member-date">Entrou em {formatarData(membro.entrouEm)}</span>
                    </div>
                    <Badge role={papelParaBadge(membro.papel)} />
                    {eMestre && membro.papel === 'jogador' && (
                      <RemoverMembro campanhaId={campanhaId} membro={membro} aoRemover={aoRemover} />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {membros.isSuccess && membros.data.membros.length === 1 && eMestre && (
              <EmptyState
                title="Falta reunir a mesa"
                description="Compartilhe o código de convite para os jogadores entrarem."
                action={null}
              />
            )}
          </Surface>

          <p className="campaign-footnote">
            {eMestre
              ? 'Você é o mestre desta campanha e gerencia quem participa.'
              : 'O mestre gerencia os convites e os membros desta campanha.'}
          </p>
        </section>

        <aside className="campaign-aside" aria-label="Convite">
          {/* O código só chega ao mestre; para jogador a API nem o devolve. */}
          {campanha.data?.codigoConvite && (
            <Surface>
              <p className="campaign-eyebrow">Convite</p>
              <p className="mt-1 mb-3 text-small text-text-secondary">
                Quem tiver este código entra na campanha como jogador.
              </p>
              <CopyField value={campanha.data.codigoConvite} />
            </Surface>
          )}
        </aside>
      </div>

      <Toast
        open={removido}
        onOpenChange={setRemovido}
        variant="success"
        title="Jogador removido"
        description="A lista de membros foi atualizada."
      />
    </main>
  );
}
