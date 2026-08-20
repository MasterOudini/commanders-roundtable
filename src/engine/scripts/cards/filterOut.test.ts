// `Filter Out` — the artifact and the enchantment bounce; the creature
// and the land stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FILTER_OUT_SCRIPT } from './filterOut';
import { FILTER_OUT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function filtered(): { g: Game; ring: InstanceId; flame: InstanceId; bears: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Filter Out'], ['Sol Ring', 'Captive Flame', 'Grizzly Bears', 'Mountain']],
    scripts: createRegistry([FILTER_OUT_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  const flame = put(g, 'p2', 'Captive Flame');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Filter Out', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, ring, flame, bears, land };
}

describe('Filter Out', () => {
  test('the artifact and enchantment bounce; the creature and land stand', () => {
    const { g, ring, flame, bears, land } = filtered();
    expect(g.state.cards[ring]?.zone.kind).toBe('hand');
    expect(g.state.cards[flame]?.zone.kind).toBe('hand');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FILTER_OUT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FILTER_OUT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FILTER_OUT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = filtered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
