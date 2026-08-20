// `Laquatus's Creativity` — the target draws their hand's worth, then
// the DISCARD ask lands on THEM; the driver's answer settles the hand
// back to its starting size.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LAQUATUSS_CREATIVITY_SCRIPT } from './laquatussCreativity';
import { LAQUATUS_S_CREATIVITY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function created(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [["Laquatus's Creativity"], ['Grizzly Bears']],
    scripts: createRegistry([LAQUATUSS_CREATIVITY_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Laquatus's Creativity", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const before = (g.state.zones.hand['p2'] ?? []).length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
  return { g, before };
}

describe("Laquatus's Creativity", () => {
  test('draws n, then the discard ASK goes to the TARGET for n of the doubled hand', () => {
    const { g, before } = created();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('chooseFromZone');
    expect(awaiting?.kind === 'chooseFromZone' && awaiting.player).toBe('p2');
    expect(awaiting?.kind === 'chooseFromZone' && awaiting.count).toBe(before);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before * 2);
    // The stack is already empty while the ask is up, so settle() would
    // no-op — advance until the driver ANSWERS the prompt.
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
    settle(g);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LAQUATUS_S_CREATIVITY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LAQUATUS_S_CREATIVITY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LAQUATUS_S_CREATIVITY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = created();
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
