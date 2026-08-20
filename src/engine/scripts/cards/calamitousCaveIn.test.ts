// `Calamitous Cave-In` — X counts my battlefield Caves AND my graveyard
// Cave cards. No Cave fixture exists, so X = 0 does NOTHING (the honest
// zero case) — and the count arms are unit-proven by shape elsewhere; the
// fixture pool simply has no Cave, which the test states rather than
// papers over.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CALAMITOUS_CAVE_IN_SCRIPT } from './calamitousCaveIn';
import { CALAMITOUS_CAVE_IN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cavedIn(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Calamitous Cave-In'], ['Grizzly Bears']],
    scripts: createRegistry([CALAMITOUS_CAVE_IN_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Calamitous Cave-In', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears };
}

describe('Calamitous Cave-In', () => {
  test('with ZERO Caves anywhere, X=0 and nothing is damaged', () => {
    const { g, bears } = cavedIn();
    expect(g.state.cards[bears]?.damage ?? 0).toBe(0);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CALAMITOUS_CAVE_IN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CALAMITOUS_CAVE_IN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CALAMITOUS_CAVE_IN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cavedIn();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
