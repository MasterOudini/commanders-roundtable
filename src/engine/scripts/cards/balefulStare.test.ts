// `Baleful Stare` — the target opponent's hand goes PUBLIC and the draw
// counts each card ONCE if it is a Mountain OR red.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BALEFUL_STARE_SCRIPT } from './balefulStare';
import { BALEFUL_STARE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stared(): { g: Game; planted: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Baleful Stare', 'Grizzly Bears'], ['Mountain', 'Lightning Bolt', 'Grizzly Bears']],
    scripts: createRegistry([BALEFUL_STARE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  // A known hand: exactly one Mountain, one red card, one neither.
  for (const id of [...(g.state.zones.hand['p2'] ?? [])]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: id, to: { kind: 'exile', player: 'p2' } }));
  }
  const planted = [
    put(g, 'p2', 'Mountain', 'hand'),
    put(g, 'p2', 'Lightning Bolt', 'hand'),
    put(g, 'p2', 'Grizzly Bears', 'hand'),
  ];
  const spell = put(g, 'p1', 'Baleful Stare', 'hand');
  // ⚠️ Measured AFTER the put, minus the spell — `put` may fetch a copy the
  // opening hand already held (D169's counting trap), so "hand before the
  // put" over-counts by one whenever it does.
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 2);
  return { g, planted };
}

describe('Baleful Stare', () => {
  test('one Mountain + one red card + one neither draws exactly TWO, hand revealed to all', () => {
    const { g, planted } = stared();
    for (const id of planted) {
      expect(g.state.cards[id]?.revealedTo).toContain('p1');
    }
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BALEFUL_STARE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BALEFUL_STARE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BALEFUL_STARE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = stared();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
