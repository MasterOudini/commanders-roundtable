// `Metal Fatigue` — every artifact turns, whoever controls it; the creature
// stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { METAL_FATIGUE_SCRIPT } from './metalFatigue';
import { METAL_FATIGUE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fatigued(): { g: Game; ring: InstanceId; archive: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Metal Fatigue', 'Sol Ring', 'Grizzly Bears'], ['Hedron Archive']],
    scripts: createRegistry([METAL_FATIGUE_SCRIPT]),
  });
  const ring = put(g, 'p1', 'Sol Ring');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const archive = put(g, 'p2', 'Hedron Archive');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Metal Fatigue', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, ring, archive, bears };
}

describe('Metal Fatigue', () => {
  test('both artifacts turn; the Bears stands', () => {
    const { g, ring, archive, bears } = fatigued();
    expect(g.state.cards[ring]?.tapped).toBe(true);
    expect(g.state.cards[archive]?.tapped).toBe(true);
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = METAL_FATIGUE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, METAL_FATIGUE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(METAL_FATIGUE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fatigued();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
