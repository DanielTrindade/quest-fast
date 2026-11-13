import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SQUARE_METERS,
  classAttacksPerAction,
  effectiveSpeed,
  formatMeters,
  freshTurn,
  grantAction,
  isAttacksPerAction,
  movementCost,
  movementLeft,
  reachArea,
  refundTurn,
  spendMovement,
  spendTurn,
  speedFromText,
  squaresBetween,
  squaresFor,
  type TurnBudget,
} from './turn.ts';

const CELL = 50;
const at = (column: number, row: number) => ({ x: (column + 0.5) * CELL, y: (row + 0.5) * CELL });

function spent(result: ReturnType<typeof spendTurn>): TurnBudget {
  if (!result.ok) assert.fail(result.error);
  return result.budget;
}

test('every square costs 1.5 m, diagonals included', () => {
  assert.equal(squaresBetween(at(0, 0), at(3, 0), CELL), 3);
  assert.equal(squaresBetween(at(0, 0), at(3, 3), CELL), 3);
  assert.equal(squaresBetween(at(0, 0), at(3, 2), CELL), 3);
  assert.equal(movementCost(at(2, 2), at(0, 7), CELL), 5 * SQUARE_METERS);
  assert.equal(movementCost(at(4, 4), at(4, 4), CELL), 0);
});

test('a position a little off the grid rounds to the nearest square', () => {
  assert.equal(squaresBetween(at(0, 0), { x: at(2, 0).x + 10, y: at(0, 0).y - 12 }, CELL), 2);
});

test('the metres left cover whole squares only', () => {
  assert.equal(squaresFor(9), 6);
  assert.equal(squaresFor(4.5), 3);
  assert.equal(squaresFor(4), 2);
  assert.equal(squaresFor(0), 0);
  // 0.1 + 0.2 style: 3 × 1.5 summed in floating point is still three squares.
  assert.equal(squaresFor(1.5 + 1.5 + 1.5), 3);
});

test('the reach covers the whole area the movement left can reach, not just the next squares', () => {
  const map = { width: 40 * CELL, height: 40 * CELL };
  // 9 m from the middle of square (20, 20): six squares each way, a 13 × 13 block.
  const area = reachArea({ ...at(20, 20), size: 'medium' }, 9, { cellSize: CELL }, map);
  assert.equal(area.squares, 6);
  assert.deepEqual([area.left, area.top, area.right, area.bottom], [14 * CELL, 14 * CELL, 27 * CELL, 27 * CELL]);
  assert.equal((area.right - area.left) / CELL, 13);
});

test('a large creature reaches from its whole footprint, and the reach stops at the map edge', () => {
  const map = { width: 10 * CELL, height: 10 * CELL };
  // A large token (2 × 2) sits on the junction of its four squares.
  const area = reachArea({ x: 2 * CELL, y: 2 * CELL, size: 'large' }, 4.5, { cellSize: CELL }, map);
  assert.deepEqual([area.left, area.top, area.right, area.bottom], [0, 0, 6 * CELL, 6 * CELL]);
});

test('metres are written the Brazilian way', () => {
  assert.equal(formatMeters(4.5), '4,5 m');
  assert.equal(formatMeters(9), '9 m');
});

test('the walking speed comes from the first number of the bestiary text', () => {
  assert.equal(speedFromText('9 m, voo 18 m'), 9);
  assert.equal(speedFromText('7,5 m'), 7.5);
  assert.equal(speedFromText('12 metros, escalada 6 m'), 12);
  assert.equal(speedFromText('30 ft., fly 60 ft.'), 9);
  assert.equal(speedFromText('40 pés'), 12);
  assert.equal(speedFromText('9'), 9);
  assert.equal(speedFromText(''), null);
  assert.equal(speedFromText('voa muito rápido'), null);
});

test('Grappled, Restrained, Paralyzed, Petrified and Unconscious hold the speed at 0; each Exhaustion level takes 1.5 m', () => {
  assert.equal(effectiveSpeed(9, []), 9);
  assert.equal(effectiveSpeed(9, [{ condition: 'grappled' }]), 0);
  assert.equal(effectiveSpeed(9, [{ condition: 'restrained', roundsLeft: 2 }]), 0);
  for (const condition of ['paralyzed', 'petrified', 'unconscious'] as const) {
    assert.equal(effectiveSpeed(9, [{ condition }]), 0, condition);
  }
  // Stunned does not touch the speed in 2024.
  assert.equal(effectiveSpeed(9, [{ condition: 'stunned' }]), 9);
  assert.equal(effectiveSpeed(9, [{ condition: 'exhaustion', level: 2 }]), 6);
  assert.equal(effectiveSpeed(3, [{ condition: 'exhaustion', level: 6 }]), 0);
  assert.equal(effectiveSpeed(9, [{ condition: 'prone' }]), 9);
});

test('Extra Attack follows the class and level on the sheet', () => {
  assert.equal(classAttacksPerAction('Guerreiro', '', 4), 1);
  assert.equal(classAttacksPerAction('Guerreiro', '', 5), 2);
  assert.equal(classAttacksPerAction('guerreira', '', 11), 3);
  assert.equal(classAttacksPerAction('Fighter', '', 20), 4);
  for (const name of ['Bárbaro', 'Monge', 'Paladino', 'Patrulheiro', 'Ranger']) {
    assert.equal(classAttacksPerAction(name, '', 5), 2, name);
    assert.equal(classAttacksPerAction(name, '', 4), 1, name);
  }
  assert.equal(classAttacksPerAction('Bardo', 'Colégio da Bravura', 6), 2);
  assert.equal(classAttacksPerAction('Bardo', 'Colégio das Espadas', 5), 1);
  assert.equal(classAttacksPerAction('Bardo', 'Colégio do Conhecimento', 10), 1);
  assert.equal(classAttacksPerAction('Mago', 'Cantor da Lâmina', 6), 2);
  assert.equal(classAttacksPerAction('Mago', 'Evocação', 20), 1);
  assert.equal(classAttacksPerAction('Ladino', '', 20), 1);
});

test('attacks per action stay in their bounds', () => {
  assert.equal(isAttacksPerAction(1), true);
  assert.equal(isAttacksPerAction(8), true);
  assert.equal(isAttacksPerAction(0), false);
  assert.equal(isAttacksPerAction(2.5), false);
});

test('the first attack spends the action and leaves the Extra Attack owed', () => {
  let turn = spent(spendTurn(freshTurn(), 'attack', 2));
  assert.equal(turn.actionUsed, true);
  assert.equal(turn.attacksLeft, 1);
  turn = spent(spendTurn(turn, 'attack', 2));
  assert.equal(turn.attacksLeft, 0);
  const third = spendTurn(turn, 'attack', 2);
  assert.equal(third.ok, false);
});

test('a granted action allows a second Attack action (Action Surge)', () => {
  let turn = spent(spendTurn(freshTurn(), 'attack', 2));
  turn = spent(spendTurn(turn, 'attack', 2));
  turn = grantAction(turn);
  turn = spent(spendTurn(turn, 'attack', 2));
  assert.equal(turn.extraActions, 0);
  assert.equal(turn.attacksLeft, 1);
});

test('the action, the bonus action and the reaction are spent once each', () => {
  let turn = spent(spendTurn(freshTurn(), 'action', 1));
  assert.equal(spendTurn(turn, 'action', 1).ok, false);
  assert.equal(spendTurn(turn, 'dash', 1).ok, false);
  turn = spent(spendTurn(turn, 'bonusAction', 1));
  assert.equal(spendTurn(turn, 'bonusAction', 1).ok, false);
  turn = spent(spendTurn(turn, 'reaction', 1));
  const again = spendTurn(turn, 'reaction', 1);
  assert.deepEqual(again, { ok: false, error: 'A reação já foi usada nesta rodada.' });
});

test('another action ends an Attack action that still owed attacks', () => {
  let turn = spent(spendTurn(freshTurn(), 'attack', 3));
  turn = grantAction(turn);
  turn = spent(spendTurn(turn, 'action', 3));
  assert.equal(turn.attacksLeft, 0);
});

test('Dash spends the action and adds the speed once more', () => {
  const turn = spent(spendTurn(freshTurn(), 'dash', 1));
  assert.equal(turn.actionUsed, true);
  assert.equal(turn.dashes, 1);
  assert.equal(movementLeft(turn, 9), 18);
});

test('the master gives back what was spent', () => {
  let turn = spent(spendTurn(freshTurn(), 'attack', 2));
  turn = refundTurn(turn, 'action');
  assert.deepEqual([turn.actionUsed, turn.attacksLeft], [false, 0]);
  turn = spent(spendTurn(turn, 'dash', 1));
  turn = refundTurn(turn, 'dash');
  assert.deepEqual([turn.actionUsed, turn.dashes], [false, 0]);
  turn = refundTurn(spent(spendTurn(turn, 'bonusAction', 1)), 'bonusAction');
  turn = refundTurn(spent(spendTurn(turn, 'reaction', 1)), 'reaction');
  assert.deepEqual(turn, freshTurn());
});

test('movement is spent until it runs out, and refused past it', () => {
  let turn = freshTurn();
  const first = spendMovement(turn, 4.5, 9);
  assert.equal(first.ok, true);
  turn = (first as { budget: TurnBudget }).budget;
  assert.equal(movementLeft(turn, 9), 4.5);
  const tooFar = spendMovement(turn, 6, 9);
  assert.deepEqual(tooFar, { ok: false, error: 'O movimento custa 6 m e restam 4,5 m neste turno.' });
  // Three single squares add up to exactly what is left.
  for (let step = 0; step < 3; step += 1) {
    const move = spendMovement(turn, SQUARE_METERS, 9);
    assert.equal(move.ok, true);
    turn = (move as { budget: TurnBudget }).budget;
  }
  assert.equal(movementLeft(turn, 9), 0);
  assert.equal(spendMovement(turn, SQUARE_METERS, 9).ok, false);
  assert.equal(spendMovement(turn, 0, 9).ok, true);
});

test('a speed that dropped below what was walked leaves nothing, never less', () => {
  assert.equal(movementLeft({ dashes: 0, movementUsed: 6 }, 0), 0);
});
