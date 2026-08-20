// `Evacuation` — every creature on both boards goes home; the artifact
// stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EVACUATION_SCRIPT } from './evacuation';
import { EVACUATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function evacuated(): { g: Game; mine: InstanceId; theirs: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Evacuation', 'Grizzly Bears'], ['Grizzly Bears', 'Sol Ring']],
    scripts: createRegistry([EVACUATION_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Evacuation', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, ring };
}

describe('Evacuation', () => {
  test('every creature goes home to its owner; the artifact stays', () => {
    const { g, mine, theirs, ring } = evacuated();
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect(g.state.cards[theirs]?.zone.kind).toBe('hand');
    expect((g.state.zones.hand['p2'] ?? []).includes(theirs)).toBe(true);
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EVACUATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EVACUATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EVACUATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = evacuated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
