// `Fracturing Gust` — the artifact and the enchantment die and pay 2
// each; the indestructible Citadel survives and pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FRACTURING_GUST_SCRIPT } from './fracturingGust';
import { FRACTURING_GUST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gusted(): { g: Game; ring: InstanceId; flame: InstanceId; citadel: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Fracturing Gust'], ['Sol Ring', 'Captive Flame', 'Darksteel Citadel']],
    scripts: createRegistry([FRACTURING_GUST_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  const flame = put(g, 'p2', 'Captive Flame');
  const citadel = put(g, 'p2', 'Darksteel Citadel');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Fracturing Gust', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, ring, flame, citadel };
}

describe('Fracturing Gust', () => {
  test('two die for 4 life; the indestructible artifact land survives', () => {
    const { g, ring, flame, citadel } = gusted();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[citadel]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FRACTURING_GUST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FRACTURING_GUST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FRACTURING_GUST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = gusted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
