// `Theft of Dreams` — a draw per TAPPED creature the target opponent
// controls; their untapped ones and my own tapped ones count for nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { THEFT_OF_DREAMS_SCRIPT } from './theftOfDreams';
import { THEFT_OF_DREAMS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Theft of Dreams';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

/** `tapped` of theirs are turned; one of theirs and one of mine stay upright. */
function stolen(tapped: number): number {
  const theirDeck = [BEARS, BEARS, BEARS];
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], theirDeck],
    scripts: createRegistry([THEFT_OF_DREAMS_SCRIPT]),
  });
  const theirs: InstanceId[] = [];
  for (let i = 0; i < 3; i++) theirs.push(put(g, 'p2', BEARS));
  const mine = put(g, 'p1', BEARS);
  settle(g);
  const turn = theirs.slice(0, tapped);
  if (turn.length > 0) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: turn, tapped: true }));
  }
  // One of MINE is tapped too, and must not count.
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mine], tapped: true }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return drawn(g, since);
}

describe('Theft of Dreams', () => {
  test('TWO of theirs tapped draws exactly two — mine does not count', () => {
    expect(stolen(2)).toBe(2);
  });

  test('none of theirs tapped is a true no-op', () => {
    expect(stolen(0)).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = THEFT_OF_DREAMS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, THEFT_OF_DREAMS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(THEFT_OF_DREAMS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SPELL, BEARS], [BEARS]],
      scripts: createRegistry([THEFT_OF_DREAMS_SCRIPT]),
    });
    const theirs = put(g, 'p2', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [theirs], tapped: true }));
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    const spell = put(g, 'p1', SPELL, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
