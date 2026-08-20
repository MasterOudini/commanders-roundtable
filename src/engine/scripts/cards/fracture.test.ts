// `Fracture` — an artifact target and an enchantment target both die
// through the freshly widened compound.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FRACTURE_SCRIPT } from './fracture';
import { FRACTURE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fractured(name: 'Sol Ring' | 'Captive Flame'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Fracture'], ['Sol Ring', 'Captive Flame']],
    scripts: createRegistry([FRACTURE_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Fracture', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Fracture', () => {
  test('an artifact and an enchantment both die through the widened compound', () => {
    const a = fractured('Sol Ring');
    expect(a.g.state.cards[a.victim]?.zone.kind).toBe('graveyard');
    const b = fractured('Captive Flame');
    expect(b.g.state.cards[b.victim]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FRACTURE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FRACTURE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FRACTURE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fractured('Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
