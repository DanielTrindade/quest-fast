import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { campaignMembers, campaigns, users, type Db } from '@quest-fast/db';
import { gerarCodigoConvite, normalizarCodigoConvite } from '@quest-fast/shared';
import type { Contexto } from '../contexto.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';

const LIMITE_NOME = 80;
const LIMITE_DESCRICAO = 500;

/**
 * O código é único por índice no banco. Colisão é improvável, mas o retry
 * mantém a criação determinística em vez de devolver erro ao mestre.
 */
function criarCampanhaComCodigo(db: Db, nome: string, descricao: string, criadorId: string) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigoConvite();
    try {
      const campanha = db
        .insert(campaigns)
        .values({ id: randomUUID(), nome, descricao, codigoConvite: codigo })
        .returning()
        .get();
      db.insert(campaignMembers)
        .values({ id: randomUUID(), campaignId: campanha.id, userId: criadorId, papel: 'mestre' })
        .run();
      return campanha;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : '';
      if (!mensagem.includes('UNIQUE') || tentativa === 4) throw erro;
    }
  }
  throw new Error('Não foi possível gerar um código de convite único.');
}

function textoValido(valor: unknown, limite: number): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim();
  return limpo.length > 0 && limpo.length <= limite ? limpo : undefined;
}

export function rotasDeCampanhas() {
  const rotas = new Hono<Contexto>();
  rotas.use('*', requireAuth);

  rotas.post('/', async (c) => {
    const { db } = c.var.deps;
    const corpo = await c.req.json().catch(() => ({}));
    const nome = textoValido(corpo?.nome, LIMITE_NOME);
    if (!nome) return c.json({ erro: `Informe um nome de até ${LIMITE_NOME} caracteres.` }, 422);

    const descricaoBruta = typeof corpo?.descricao === 'string' ? corpo.descricao.trim() : '';
    if (descricaoBruta.length > LIMITE_DESCRICAO) {
      return c.json({ erro: `A descrição deve ter até ${LIMITE_DESCRICAO} caracteres.` }, 422);
    }

    const campanha = criarCampanhaComCodigo(db, nome, descricaoBruta, c.var.usuario.id);
    return c.json(
      {
        id: campanha.id,
        nome: campanha.nome,
        descricao: campanha.descricao,
        papel: 'mestre',
        codigoConvite: campanha.codigoConvite,
      },
      201,
    );
  });

  rotas.get('/', (c) => {
    const { db } = c.var.deps;
    const linhas = db
      .select({
        id: campaigns.id,
        nome: campaigns.nome,
        descricao: campaigns.descricao,
        papel: campaignMembers.papel,
        entrouEm: campaignMembers.entrouEm,
      })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .where(eq(campaignMembers.userId, c.var.usuario.id))
      .orderBy(desc(campaignMembers.entrouEm))
      .all();
    return c.json({ campanhas: linhas });
  });

  rotas.post('/entrar', async (c) => {
    const { db } = c.var.deps;
    const corpo = await c.req.json().catch(() => ({}));
    const codigo = typeof corpo?.codigo === 'string' ? normalizarCodigoConvite(corpo.codigo) : undefined;
    if (!codigo) return c.json({ erro: 'Código de convite inválido.' }, 422);

    const campanha = db.select().from(campaigns).where(eq(campaigns.codigoConvite, codigo)).get();
    if (!campanha) return c.json({ erro: 'Código de convite inválido.' }, 404);

    const jaMembro = db
      .select({ papel: campaignMembers.papel })
      .from(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, campanha.id), eq(campaignMembers.userId, c.var.usuario.id)))
      .get();

    // Reentrar com o mesmo código leva para a campanha, sem duplicar a participação.
    if (jaMembro) return c.json({ id: campanha.id, nome: campanha.nome, papel: jaMembro.papel }, 200);

    db.insert(campaignMembers)
      .values({ id: randomUUID(), campaignId: campanha.id, userId: c.var.usuario.id, papel: 'jogador' })
      .run();
    return c.json({ id: campanha.id, nome: campanha.nome, papel: 'jogador' }, 201);
  });

  rotas.get('/:campanhaId', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    const campanha = db.select().from(campaigns).where(eq(campaigns.id, c.var.campanhaId)).get();
    if (!campanha) return c.json({ erro: 'Campanha não encontrada.' }, 404);
    return c.json({
      id: campanha.id,
      nome: campanha.nome,
      descricao: campanha.descricao,
      papel: c.var.papel,
      // O código só existe na resposta do mestre.
      ...(c.var.papel === 'mestre' ? { codigoConvite: campanha.codigoConvite } : {}),
    });
  });

  rotas.get('/:campanhaId/membros', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    const membros = db
      .select({
        id: campaignMembers.id,
        usuarioId: users.id,
        nome: users.nome,
        avatarUrl: users.avatarUrl,
        papel: campaignMembers.papel,
        entrouEm: campaignMembers.entrouEm,
      })
      .from(campaignMembers)
      .innerJoin(users, eq(users.id, campaignMembers.userId))
      .where(eq(campaignMembers.campaignId, c.var.campanhaId))
      // Mestre primeiro; depois ordem de entrada. Sem o desempate por id, dois
      // membros que entraram no mesmo segundo sairiam em ordem indefinida.
      .orderBy(
        sql`case ${campaignMembers.papel} when 'mestre' then 0 else 1 end`,
        campaignMembers.entrouEm,
        campaignMembers.id,
      )
      .all();
    return c.json({ membros });
  });

  rotas.delete('/:campanhaId/membros/eu', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    // Sair deixaria a campanha sem mestre; a operação é recusada.
    if (c.var.papel === 'mestre') {
      return c.json({ erro: 'O mestre não pode sair da própria campanha.' }, 409);
    }
    db.delete(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, c.var.campanhaId), eq(campaignMembers.userId, c.var.usuario.id)))
      .run();
    return c.body(null, 204);
  });

  rotas.delete('/:campanhaId/membros/:membroId', requireCampaignRole('mestre'), (c) => {
    const { db } = c.var.deps;
    const membroId = c.req.param('membroId');
    const alvo = db
      .select()
      .from(campaignMembers)
      .where(and(eq(campaignMembers.id, membroId), eq(campaignMembers.campaignId, c.var.campanhaId)))
      .get();

    if (!alvo) return c.json({ erro: 'Membro não encontrado.' }, 404);
    if (alvo.papel === 'mestre') return c.json({ erro: 'O mestre não pode ser removido.' }, 409);

    db.delete(campaignMembers).where(eq(campaignMembers.id, alvo.id)).run();
    return c.body(null, 204);
  });

  return rotas;
}
