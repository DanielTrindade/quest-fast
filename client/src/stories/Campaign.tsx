import { useId, useState } from 'react';
import { Plus, ArrowUpRight, Users } from '@phosphor-icons/react';
import { AppShell } from '../components/AppShell';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { CopyField } from '../components/CopyField';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Surface } from '../components/Surface';
import { Toast, ToastProvider } from '../components/Toast';
import './campaign.css';

// Dados e ações locais do laboratório. Autorização e persistência ficam no MVP.
const initialMembers = [
  { id: 'lia', name: 'Lia Martins', role: 'master' as const, joined: '02 set. 2026' },
  { id: 'rafael', name: 'Rafael Costa', role: 'player' as const, joined: '03 set. 2026' },
  { id: 'ana', name: 'Ana Beatriz', role: 'player' as const, joined: '03 set. 2026' },
  { id: 'pedro', name: 'Pedro Alves', role: 'player' as const, joined: '04 set. 2026' },
];
const campaigns = [{ id: 'phandalin', name: 'Ecos de Phandalin' }, { id: 'barovia', name: 'A névoa de Baróvia' }];

export function Campaign({ role = 'master', loading = false, empty = false }: {
  role?: 'master' | 'player'; loading?: boolean; empty?: boolean;
}) {
  const id = useId();
  const [campaign, setCampaign] = useState('phandalin');
  const [members, setMembers] = useState(empty ? initialMembers.slice(0, 1) : initialMembers);
  const [toast, setToast] = useState(false);
  const [invite, setInvite] = useState(false);
  const [removing, setRemoving] = useState<string>();
  const master = role === 'master';
  const selected = campaigns.find(item => item.id === campaign)!;
  function changeCampaign(value: string) {
    setCampaign(value); setMembers(value === 'barovia' ? initialMembers.slice(0, 1) : initialMembers);
  }
  const inviteContent = <CopyField value={campaign === 'phandalin' ? 'MESA42' : 'NEVOA7'} />;
  return <ToastProvider>
    <AppShell campaigns={campaigns} campaignId={campaign} onCampaignChange={changeCampaign}
      navigation={[{ id: 'members', label: 'Membros', href: `#${id}-members` }, { id: 'session', label: 'Próxima sessão', href: `#${id}-session` }]}
      activeItem="members" user={<><Avatar name={master ? 'Lia Martins' : 'Rafael Costa'} /><span className="campaign-user">{master ? 'Lia' : 'Rafael'}</span></>}>
      <header className="campaign-heading">
        <div><p className="campaign-eyebrow">Sua mesa · D&D 5e</p><h1>{selected.name}</h1>
          <p className="campaign-description">A próxima aventura começa com a mesa reunida.</p></div>
        {master && <Dialog trigger={<Button><Plus size={18} aria-hidden="true" />Convidar jogadores</Button>}
          title="Reúna sua mesa" description="Envie o código para quem vai participar da campanha." open={invite} onOpenChange={setInvite}>
          {inviteContent}
        </Dialog>}
      </header>
      <div className="campaign-layout">
        <section id={`${id}-members`} className="campaign-members" aria-labelledby={`${id}-members-title`}>
          <div className="campaign-section-heading"><h2 id={`${id}-members-title`}><Users size={20} aria-hidden="true" />Membros</h2>
            <span>{loading ? 'Carregando…' : `${members.length} na mesa`}</span></div>
          <Surface className="campaign-roster">
            {loading ? <div className="qf-stack" role="region" aria-label="Carregando membros" aria-busy="true">
              {[0, 1, 2].map(row => <div key={row} className="qf-member"><Skeleton shape="avatar" /><div className="qf-stack"><Skeleton width="60%" /><Skeleton width="80%" /></div></div>)}
            </div> : <ul>
              {members.map(member => <li key={member.id} className="qf-member">
                <Avatar name={member.name} />
                <div className="campaign-member-info"><span className="campaign-member-name">{member.name}{member.id === (master ? 'lia' : 'rafael') && <span className="text-text-muted"> (você)</span>}</span>
                  <span className="campaign-member-date">Entrou em {member.joined}</span></div>
                <Badge role={member.role} />
                {master && member.role === 'player' && <Dialog trigger={<Button variant="ghost" aria-label={`Remover ${member.name}`}>Remover</Button>}
                  title={`Remover ${member.name}?`} description="Esta pessoa deixará de participar da campanha. Você poderá convidá-la novamente."
                  open={removing === member.id} onOpenChange={open => setRemoving(open ? member.id : undefined)}>
                  <div className="qf-dialog__actions"><Button variant="secondary" onClick={() => setRemoving(undefined)}>Cancelar</Button>
                    <Button variant="danger" onClick={() => { setMembers(current => current.filter(item => item.id !== member.id)); setRemoving(undefined); setToast(true); }}>Remover jogador</Button></div>
                </Dialog>}
              </li>)}
            </ul>}
            {!loading && members.length === 1 && <EmptyState title="Falta reunir a mesa" description="Convide os jogadores para fazer parte desta aventura."
              action={<Button variant="secondary" onClick={() => setInvite(true)}><Plus size={18} aria-hidden="true" />Convidar jogadores</Button>} />}
          </Surface>
          <p className="campaign-footnote">{master ? 'Você é o mestre desta campanha e gerencia quem participa.' : 'O mestre gerencia os convites e os membros desta campanha.'}</p>
        </section>
        <aside className="campaign-aside" aria-label="Preparação da sessão">
          <Surface id={`${id}-session`}>
            <p className="campaign-eyebrow">Próximo encontro</p><h2 className="campaign-session-title">Sábado, às 19h</h2>
            <p className="campaign-description">Os caminhos até a mina</p>
            <p className="campaign-session-note">Traga sua ficha atualizada. A conversa acontece no Discord.</p>
            <span className="campaign-session-link"><ArrowUpRight size={16} aria-hidden="true" /> Sessão 04 · preparação</span>
          </Surface>
          {master && <Surface variant="secret"><h2 className="campaign-note-title">Antes de começar</h2><p>Edgar sabe mais sobre a mina do que contou ao grupo. Retome a pista da última sessão.</p></Surface>}
        </aside>
      </div>
    </AppShell>
    <Toast open={toast} onOpenChange={setToast} variant="success" title="Jogador removido" description="A lista de membros foi atualizada." />
  </ToastProvider>;
}
