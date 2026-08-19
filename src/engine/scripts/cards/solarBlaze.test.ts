// `Solar Blaze` — every creature burns itself for its own power: the Bears
// die of their own 2, the 0-power Wall deals nothing and stands behind its
// four toughness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SOLAR_BLAZE_SCRIPT } from './solarBlaze';
import { SOLAR_BLAZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; bears: InstanceId; wall: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Solar Blaze', 'Wall of Omens'], ['Grizzly Bears']],
    scripts: createRegistry([SOLAR_BLAZE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const wall = put(g, 'p1', 'Wall of Omens');
  settle(g);
  const spell = put(g, 'p1', 'Solar Blaze', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, wall };
}

describe('Solar Blaze', () => {
  test('the Bears die of their own power; the 0-power Wall stands', () => {
    const { g, bears, wall } = board();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[wall]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SOLAR_BLAZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SOLAR_BLAZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SOLAR_BLAZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
