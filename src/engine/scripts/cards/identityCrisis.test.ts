// `Identity Crisis` — the target's hand AND graveyard empty into exile;
// mine are untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { IDENTITY_CRISIS_SCRIPT } from './identityCrisis';
import { IDENTITY_CRISIS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function erased(): { g: Game; handCard: InstanceId; deadCard: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Identity Crisis'], ['Grizzly Bears', 'Elvish Herder']],
    scripts: createRegistry([IDENTITY_CRISIS_SCRIPT]),
  });
  const handCard = put(g, 'p2', 'Grizzly Bears', 'hand');
  const deadCard = put(g, 'p2', 'Elvish Herder', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Identity Crisis', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, handCard, deadCard };
}

describe('Identity Crisis', () => {
  test('their whole hand and graveyard are exiled; my zones stand', () => {
    const { g, handCard, deadCard } = erased();
    expect(g.state.cards[handCard]?.zone.kind).toBe('exile');
    expect(g.state.cards[deadCard]?.zone.kind).toBe('exile');
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(0);
    expect((g.state.zones.graveyard['p2'] ?? []).length).toBe(0);
    expect((g.state.zones.hand['p1'] ?? []).length).toBeGreaterThan(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = IDENTITY_CRISIS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, IDENTITY_CRISIS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(IDENTITY_CRISIS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = erased();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
