// `Tectonic Hazard` — the fan reaches each opponent AND their board, and
// stops at the table's edge: my own creature and my own face are untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TECTONIC_HAZARD_SCRIPT } from './tectonicHazard';
import { TECTONIC_HAZARD } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HAZARD = 'Tectonic Hazard';
const ONE_ONE = 'Dryad Arbor'; // a 1/1 — one point kills it
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hazarded(): { g: Game; theirs: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 3,
    decks: [[HAZARD, BEARS], [ONE_ONE], [BEARS]],
    scripts: createRegistry([TECTONIC_HAZARD_SCRIPT]),
  });
  const theirs = put(g, 'p2', ONE_ONE);
  const mine = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', HAZARD, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, theirs, mine };
}

describe('Tectonic Hazard', () => {
  test('each opponent takes 1 and their 1/1 dies; I take nothing', () => {
    const { g, theirs, mine } = hazarded();
    expect(g.state.players.p2?.life).toBe(39);
    expect(g.state.players.p3?.life).toBe(39);
    expect(g.state.players.p1?.life).toBe(40);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TECTONIC_HAZARD.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TECTONIC_HAZARD.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TECTONIC_HAZARD.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = hazarded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
