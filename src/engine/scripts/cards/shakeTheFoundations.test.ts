// `Shake the Foundations` — every non-flier on the board is marked 1 (mine
// included), the flier is untouched, and I draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SHAKE_THE_FOUNDATIONS_SCRIPT } from './shakeTheFoundations';
import { SHAKE_THE_FOUNDATIONS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Shake the Foundations';
const BEARS = 'Grizzly Bears';
const ANGEL = 'Dazzling Angel'; // a 2/3 flier

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function shaken(): { g: Game; mine: InstanceId; theirs: InstanceId; flier: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], [BEARS, ANGEL]],
    scripts: createRegistry([SHAKE_THE_FOUNDATIONS_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  const flier = put(g, 'p2', ANGEL);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, flier, logAt };
}

describe('Shake the Foundations', () => {
  test('1 to each non-flier on both sides, none to the flier, and a card', () => {
    const { g, mine, theirs, flier, logAt } = shaken();
    expect(g.state.cards[mine]?.damage).toBe(1);
    expect(g.state.cards[theirs]?.damage).toBe(1);
    expect(g.state.cards[flier]?.damage).toBe(0);
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SHAKE_THE_FOUNDATIONS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SHAKE_THE_FOUNDATIONS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SHAKE_THE_FOUNDATIONS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = shaken();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
