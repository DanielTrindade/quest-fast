import { useId, useState } from 'react';
import { ArrowUpRight, CalendarBlank, EyeSlash, Plus, UserMinus, Users } from '@phosphor-icons/react';
import { AppShell } from '../components/AppShell';
import { CopyField } from '../components/CopyField';
import { useNotify } from '../hooks/use-notify';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Button } from '../components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

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
  const notify = useNotify();
  const [invite, setInvite] = useState(false);
  const [removing, setRemoving] = useState<string>();
  const [collapsed, setCollapsed] = useState(false);
  const master = role === 'master';
  const selected = campaigns.find(item => item.id === campaign)!;
  const self = master ? 'lia' : 'rafael';
  function changeCampaign(value: string) {
    setCampaign(value); setMembers(value === 'barovia' ? initialMembers.slice(0, 1) : initialMembers);
  }
  const inviteDialog = <DialogContent>
    <DialogHeader>
      <DialogTitle>Reúna sua mesa</DialogTitle>
      <DialogDescription>Envie o código para quem vai participar da campanha.</DialogDescription>
    </DialogHeader>
    <CopyField value={campaign === 'phandalin' ? 'MESA42' : 'NEVOA7'} />
  </DialogContent>;
  return <TooltipProvider>
    <AppShell campaigns={campaigns.map(item => ({ ...item, role }))} campaignId={campaign} onCampaignChange={changeCampaign}
      navigation={[{ id: 'members', label: 'Membros', href: `#${id}-members`, icon: Users }, { id: 'session', label: 'Próxima sessão', shortLabel: 'Sessão', href: `#${id}-session`, icon: CalendarBlank }]}
      activeItem="members" account={{ name: master ? 'Lia Martins' : 'Rafael Costa', avatarUrl: null, onSignOut: () => {} }}
      collapsed={collapsed} onCollapsedChange={setCollapsed}>
      <div className="@container mx-auto w-full max-w-[1400px]">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-small text-text-muted">Sua mesa · D&amp;D 5e</p>
            <h1 className="mt-2 font-display text-h1 font-semibold tracking-tight @lg:text-display">{selected.name}</h1>
            <p className="mt-2 text-muted-foreground">A próxima aventura começa com a mesa reunida.</p>
          </div>
          {master && <Dialog open={invite} onOpenChange={setInvite}>
            <DialogTrigger asChild><Button><Plus size={18} aria-hidden="true" />Convidar jogadores</Button></DialogTrigger>
            {inviteDialog}
          </Dialog>}
        </header>

        <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_300px] @3xl:items-start">
          <section id={`${id}-members`} aria-labelledby={`${id}-members-title`} className="min-w-0">
            <Card className="gap-0 py-0">
              <CardHeader className="border-b border-border px-4 py-4 @md:px-6">
                <CardTitle asChild><h2 id={`${id}-members-title`} className="flex items-center gap-2"><Users size={20} aria-hidden="true" />Membros</h2></CardTitle>
                <CardDescription className="font-mono text-small">{loading ? 'Carregando…' : `${members.length} na mesa`}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 @md:px-6">
                {loading ? <div className="grid" role="region" aria-label="Carregando membros" aria-busy="true">
                  {[0, 1, 2].map(row => <div key={row} className="flex items-center gap-3 border-border py-4 not-first:border-t">
                    <Skeleton className="size-10 shrink-0 rounded-full" /><div className="grid flex-1 gap-2"><Skeleton className="w-3/5" /><Skeleton className="w-4/5" /></div>
                  </div>)}
                </div> : <ul>
                  {members.map(member => <li key={member.id} className="flex items-center gap-3 border-border py-4 not-first:border-t">
                    <Avatar name={member.name} />
                    <div className="grid min-w-0 flex-1 gap-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium">{member.name}{member.id === self && <span className="text-text-muted"> (você)</span>}</span>
                        <Badge role={member.role} />
                      </span>
                      <span className="text-small text-text-muted">Entrou em {member.joined}</span>
                    </div>
                    {master && member.role === 'player' && <Dialog open={removing === member.id} onOpenChange={open => setRemoving(open ? member.id : undefined)}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-text-secondary hover:text-danger-text" aria-label={`Remover ${member.name}`}>
                              <UserMinus size={20} aria-hidden="true" />
                            </Button>
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="left">Remover da campanha</TooltipContent>
                      </Tooltip>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Remover {member.name}?</DialogTitle>
                          <DialogDescription>Esta pessoa deixará de participar da campanha. Você poderá convidá-la novamente.</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                          <Button variant="destructive" onClick={() => { setMembers(current => current.filter(item => item.id !== member.id)); setRemoving(undefined); notify({ variant: 'success', title: 'Jogador removido', description: 'A lista de membros foi atualizada.' }); }}>Remover jogador</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>}
                  </li>)}
                </ul>}
                {!loading && members.length === 1 && <div className="grid justify-items-start gap-3 border-t border-border py-6">
                  <h3 className="font-display text-h2 font-semibold">Falta reunir a mesa</h3>
                  <p className="max-w-[48ch] text-muted-foreground">Convide os jogadores para fazer parte desta aventura.</p>
                  {master && <Button variant="secondary" onClick={() => setInvite(true)}><Plus size={18} aria-hidden="true" />Convidar jogadores</Button>}
                </div>}
              </CardContent>
            </Card>
            <p className="mt-3 text-small text-text-muted">{master ? 'Você é o mestre desta campanha e gerencia quem participa.' : 'O mestre gerencia os convites e os membros desta campanha.'}</p>
          </section>

          <aside className="grid min-w-0 content-start gap-6" aria-label="Preparação da sessão">
            <Card id={`${id}-session`} className="gap-4">
              <CardHeader>
                <p className="text-small text-text-muted">Próximo encontro</p>
                <CardTitle asChild><h2 className="text-h1 tracking-tight">Sábado, às 19h</h2></CardTitle>
                <CardDescription>Os caminhos até a mina</CardDescription>
                <CardAction><CalendarBlank size={20} className="text-accent-text" aria-hidden="true" /></CardAction>
              </CardHeader>
              <CardContent className="text-small text-text-muted">Traga sua ficha atualizada. A conversa acontece no Discord.</CardContent>
              <Separator />
              <CardFooter className="text-small text-text-secondary"><ArrowUpRight size={16} aria-hidden="true" />Sessão 04 · preparação</CardFooter>
            </Card>
            {master && <Card className="gap-3 border-dashed border-input bg-surface-secret shadow-none">
              <CardHeader>
                <p className="flex items-center gap-2 text-small text-text-secondary"><EyeSlash size={16} aria-hidden="true" />Só você vê isto</p>
                <CardTitle asChild><h2 className="text-body">Antes de começar</h2></CardTitle>
              </CardHeader>
              <CardContent className="text-small text-text-secondary">Edgar sabe mais sobre a mina do que contou ao grupo. Retome a pista da última sessão.</CardContent>
            </Card>}
          </aside>
        </div>
      </div>
    </AppShell>
  </TooltipProvider>;
}
