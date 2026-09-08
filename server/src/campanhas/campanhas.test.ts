import test from 'node:test';
import assert from 'node:assert/strict';
import type { CampanhaCriada, MembroDaCampanha, RespostaCampanhas, RespostaMembros, CampanhaDetalhe } from '@quest-fast/shared';
import { comoUsuario, corpo, entrar, montarMesa } from '../testing.ts';

const PERFIS = {
  lia: { discordId: '111', nome: 'Lia Martins', avatarUrl: null },
  rafael: { discordId: '222', nome: 'Rafael Costa', avatarUrl: null },
  intrusa: { discordId: '333', nome: 'Ana Estranha', avatarUrl: null },
};

/** Mestre com uma campanha, um jogador dentro e alguém de fora. */
async function mesaComCampanha() {
  const m = montarMesa(PERFIS);
  const mestre = comoUsuario(m, await entrar(m, 'lia'));
  const jogador = comoUsuario(m, await entrar(m, 'rafael'));
  const forasteira = comoUsuario(m, await entrar(m, 'intrusa'));

  const criada = await mestre('/api/campanhas', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Ecos de Phandalin', descricao: 'A mesa de terça.' }),
  });
  const campanha = await corpo<CampanhaCriada>(criada);
  await jogador('/api/campanhas/entrar', {
    method: 'POST',
    body: JSON.stringify({ codigo: campanha.codigoConvite }),
  });

  return { m, mestre, jogador, forasteira, campanha };
}

async function membroDe(
  req: ReturnType<typeof comoUsuario>,
  campanhaId: string,
  nome: string,
): Promise<MembroDaCampanha> {
  const { membros } = await corpo<RespostaMembros>(await req(`/api/campanhas/${campanhaId}/membros`));
  const alvo = membros.find((membro) => membro.nome === nome);
  if (!alvo) throw new Error(`membro ${nome} não encontrado`);
  return alvo;
}

test('criar campanha torna o criador mestre e devolve o código', async () => {
  const m = montarMesa(PERFIS);
  const mestre = comoUsuario(m, await entrar(m, 'lia'));
  const resposta = await mestre('/api/campanhas', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Ecos de Phandalin', descricao: 'A mesa de terça.' }),
  });

  assert.equal(resposta.status, 201);
  const campanha = await corpo<CampanhaCriada>(resposta);
  assert.equal(campanha.papel, 'mestre');
  assert.match(campanha.codigoConvite, /^[A-Z2-9]{6}$/);
});

test('campanha exige nome', async () => {
  const m = montarMesa(PERFIS);
  const mestre = comoUsuario(m, await entrar(m, 'lia'));
  for (const invalido of [{}, { nome: '   ' }, { nome: 'x'.repeat(81) }]) {
    const resposta = await mestre('/api/campanhas', { method: 'POST', body: JSON.stringify(invalido) });
    assert.equal(resposta.status, 422, JSON.stringify(invalido));
  }
});

test('a listagem traz apenas as campanhas de que o usuário é membro', async () => {
  const { mestre, jogador, forasteira } = await mesaComCampanha();

  assert.equal((await corpo<RespostaCampanhas>(await mestre('/api/campanhas'))).campanhas.length, 1);
  assert.equal((await corpo<RespostaCampanhas>(await jogador('/api/campanhas'))).campanhas.length, 1);
  assert.deepEqual((await corpo<RespostaCampanhas>(await forasteira('/api/campanhas'))).campanhas, []);
});

test('entrar com código válido cria participação de jogador', async () => {
  const { jogador, campanha } = await mesaComCampanha();
  const detalhe = await corpo<CampanhaDetalhe>(await jogador(`/api/campanhas/${campanha.id}`));
  assert.equal(detalhe.papel, 'jogador');
});

test('código inválido não altera a participação', async () => {
  const { forasteira } = await mesaComCampanha();
  const resposta = await forasteira('/api/campanhas/entrar', {
    method: 'POST',
    body: JSON.stringify({ codigo: 'ZZZZZZ' }),
  });
  assert.equal(resposta.status, 404);
  assert.deepEqual((await corpo<RespostaCampanhas>(await forasteira('/api/campanhas'))).campanhas, []);
});

test('código malformado é recusado antes da consulta', async () => {
  const { forasteira } = await mesaComCampanha();
  for (const codigo of ['', 'ABC', 'MES@42', 'MESA4O']) {
    const resposta = await forasteira('/api/campanhas/entrar', {
      method: 'POST',
      body: JSON.stringify({ codigo }),
    });
    assert.equal(resposta.status, 422, codigo);
  }
});

test('entrar de novo com o mesmo código não duplica a participação', async () => {
  const { jogador, campanha } = await mesaComCampanha();
  const repetida = await jogador('/api/campanhas/entrar', {
    method: 'POST',
    body: JSON.stringify({ codigo: campanha.codigoConvite }),
  });

  assert.equal(repetida.status, 200);
  const { membros } = await corpo<RespostaMembros>(await jogador(`/api/campanhas/${campanha.id}/membros`));
  assert.equal(membros.length, 2);
});

test('o código de convite não é exposto ao jogador', async () => {
  const { mestre, jogador, campanha } = await mesaComCampanha();

  const visaoMestre = await corpo<CampanhaDetalhe>(await mestre(`/api/campanhas/${campanha.id}`));
  assert.ok(visaoMestre.codigoConvite);

  const visaoJogador = await corpo<CampanhaDetalhe>(await jogador(`/api/campanhas/${campanha.id}`));
  assert.equal('codigoConvite' in visaoJogador, false);
  assert.equal(JSON.stringify(visaoJogador).includes(campanha.codigoConvite), false);
});

test('a lista de membros traz nome, papel e data de entrada', async () => {
  const { jogador, campanha } = await mesaComCampanha();
  const { membros } = await corpo<RespostaMembros>(await jogador(`/api/campanhas/${campanha.id}/membros`));

  assert.equal(membros.length, 2);
  assert.deepEqual(
    membros.map((m) => [m.nome, m.papel]).sort(),
    [['Lia Martins', 'mestre'], ['Rafael Costa', 'jogador']].sort(),
  );
  // A data trafega como ISO 8601; a formatação para a mesa é do cliente.
  assert.ok(
    membros.every((m) => !Number.isNaN(Date.parse(m.entrouEm))),
    `datas inválidas: ${membros.map((m) => m.entrouEm).join(', ')}`,
  );
});

// --- RBAC: o que cada papel NÃO pode fazer -------------------------------

test('não-membro não lê a campanha nem os membros', async () => {
  const { forasteira, campanha } = await mesaComCampanha();

  for (const rota of [`/api/campanhas/${campanha.id}`, `/api/campanhas/${campanha.id}/membros`]) {
    const resposta = await forasteira(rota);
    // 404, não 403: confirmar que a campanha existe já é vazamento.
    assert.equal(resposta.status, 404, rota);
    const texto = JSON.stringify(await resposta.json());
    assert.equal(texto.includes('Ecos de Phandalin'), false, rota);
    assert.equal(texto.includes(campanha.codigoConvite), false, rota);
  }
});

test('não-membro não remove membro', async () => {
  const { mestre, forasteira, campanha } = await mesaComCampanha();
  const alvo = await membroDe(mestre, campanha.id, 'Rafael Costa');

  const resposta = await forasteira(`/api/campanhas/${campanha.id}/membros/${alvo.id}`, { method: 'DELETE' });
  assert.equal(resposta.status, 404);
  assert.equal((await corpo<RespostaMembros>(await mestre(`/api/campanhas/${campanha.id}/membros`))).membros.length, 2);
});

test('jogador não remove outro membro', async () => {
  const m = montarMesa({ ...PERFIS, quarta: { discordId: '444', nome: 'Pedro Alves', avatarUrl: null } });
  const mestre = comoUsuario(m, await entrar(m, 'lia'));
  const jogador = comoUsuario(m, await entrar(m, 'rafael'));
  const outro = comoUsuario(m, await entrar(m, 'quarta'));

  const campanha = await corpo<CampanhaCriada>(
    await mestre('/api/campanhas', { method: 'POST', body: JSON.stringify({ nome: 'Baróvia' }) }),
  );
  for (const req of [jogador, outro]) {
    await req('/api/campanhas/entrar', { method: 'POST', body: JSON.stringify({ codigo: campanha.codigoConvite }) });
  }

  const alvo = await membroDe(mestre, campanha.id, 'Pedro Alves');
  const resposta = await jogador(`/api/campanhas/${campanha.id}/membros/${alvo.id}`, { method: 'DELETE' });

  assert.equal(resposta.status, 403);
  assert.equal((await corpo<RespostaMembros>(await mestre(`/api/campanhas/${campanha.id}/membros`))).membros.length, 3);
});

test('mestre remove jogador, que perde o acesso à campanha', async () => {
  const { mestre, jogador, campanha } = await mesaComCampanha();
  const alvo = await membroDe(mestre, campanha.id, 'Rafael Costa');

  const resposta = await mestre(`/api/campanhas/${campanha.id}/membros/${alvo.id}`, { method: 'DELETE' });
  assert.equal(resposta.status, 204);
  assert.equal((await jogador(`/api/campanhas/${campanha.id}`)).status, 404);
});

test('o mestre não pode ser removido', async () => {
  const { mestre, campanha } = await mesaComCampanha();
  const alvo = await membroDe(mestre, campanha.id, 'Lia Martins');

  const resposta = await mestre(`/api/campanhas/${campanha.id}/membros/${alvo.id}`, { method: 'DELETE' });
  assert.equal(resposta.status, 409);
});

test('jogador sai da campanha e perde o acesso', async () => {
  const { jogador, campanha } = await mesaComCampanha();

  assert.equal((await jogador(`/api/campanhas/${campanha.id}/membros/eu`, { method: 'DELETE' })).status, 204);
  assert.equal((await jogador(`/api/campanhas/${campanha.id}`)).status, 404);
});

test('mestre não sai da própria campanha', async () => {
  const { mestre, campanha } = await mesaComCampanha();

  const resposta = await mestre(`/api/campanhas/${campanha.id}/membros/eu`, { method: 'DELETE' });
  assert.equal(resposta.status, 409);
  assert.equal((await mestre(`/api/campanhas/${campanha.id}`)).status, 200);
});

test('remover membro de outra campanha pelo id não funciona', async () => {
  const { mestre, campanha } = await mesaComCampanha();
  const outra = await corpo<CampanhaCriada>(
    await mestre('/api/campanhas', { method: 'POST', body: JSON.stringify({ nome: 'Outra mesa' }) }),
  );
  const alvo = await membroDe(mestre, campanha.id, 'Rafael Costa');

  // O membro existe, mas pertence a outra campanha: a rota não pode alcançá-lo.
  const resposta = await mestre(`/api/campanhas/${outra.id}/membros/${alvo.id}`, { method: 'DELETE' });
  assert.equal(resposta.status, 404);
  assert.equal((await corpo<RespostaMembros>(await mestre(`/api/campanhas/${campanha.id}/membros`))).membros.length, 2);
});

test('toda rota de campanha exige sessão', async (t) => {
  const { m, campanha } = await mesaComCampanha();
  const rotas: Array<[string, string]> = [
    ['GET', `/api/campanhas`],
    ['POST', `/api/campanhas`],
    ['POST', `/api/campanhas/entrar`],
    ['GET', `/api/campanhas/${campanha.id}`],
    ['GET', `/api/campanhas/${campanha.id}/membros`],
    ['DELETE', `/api/campanhas/${campanha.id}/membros/eu`],
    ['DELETE', `/api/campanhas/${campanha.id}/membros/qualquer`],
  ];

  for (const [metodo, rota] of rotas) {
    await t.test(`${metodo} ${rota}`, async () => {
      const resposta = await m.app.request(rota, { method: metodo, headers: { 'content-type': 'application/json' } });
      assert.equal(resposta.status, 401);
    });
  }
});

test('a lista de membros começa pelo mestre, mesmo com entradas no mesmo segundo', async () => {
  const m = montarMesa({ ...PERFIS, quarta: { discordId: '444', nome: 'Pedro Alves', avatarUrl: null } });
  const mestre = comoUsuario(m, await entrar(m, 'lia'));
  const campanha = await corpo<CampanhaCriada>(
    await mestre('/api/campanhas', { method: 'POST', body: JSON.stringify({ nome: 'Ecos' }) }),
  );

  for (const codigo of ['rafael', 'intrusa', 'quarta']) {
    const jogador = comoUsuario(m, await entrar(m, codigo));
    await jogador('/api/campanhas/entrar', { method: 'POST', body: JSON.stringify({ codigo: campanha.codigoConvite }) });
  }

  const { membros } = await corpo<RespostaMembros>(await mestre(`/api/campanhas/${campanha.id}/membros`));
  assert.equal(membros[0].papel, 'mestre');
  assert.deepEqual(
    membros.slice(1).map((membro) => membro.papel),
    ['jogador', 'jogador', 'jogador'],
  );
});

test('a ordem dos membros é estável entre chamadas', async () => {
  const { mestre, campanha } = await mesaComCampanha();
  const primeira = await corpo<RespostaMembros>(await mestre(`/api/campanhas/${campanha.id}/membros`));
  const segunda = await corpo<RespostaMembros>(await mestre(`/api/campanhas/${campanha.id}/membros`));
  assert.deepEqual(
    primeira.membros.map((membro) => membro.id),
    segunda.membros.map((membro) => membro.id),
  );
});
