// `Kaya's Wrath` — everything dies, and only MY losses pay me.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { KAYAS_WRATH_SCRIPT } from './kayasWrath';
import { KAYA_S_WRATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function wrathed(): { g: Game; mine: InstanceId; a: InstanceId; b: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Kaya's Wrath", 'Grizzly Bears'], ['Elvish Herder', 'Colossal Dreadmaw']],
    scripts: createRegistry([KAYAS_WRATH_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const a = put(g, 'p2', 'Elvish Herder');
  const b = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Kaya's Wrath", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, a, b };
}

describe("Kaya's Wrath", () => {
  test('all three die; the gain counts only MY one creature', () => {
    const { g, mine, a, b } = wrathed();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = KAYA_S_WRATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, KAYA_S_WRATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(KAYA_S_WRATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = wrathed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
