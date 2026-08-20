// `Heartwarming Redemption` — the whole hand goes, n+1 come back, and
// the gain reads the refilled hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HEARTWARMING_REDEMPTION_SCRIPT } from './heartwarmingRedemption';
import { HEARTWARMING_REDEMPTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function redeemed(): { g: Game; kept: number } {
  const g = startedGame({
    players: 2,
    decks: [['Heartwarming Redemption'], ['Grizzly Bears']],
    scripts: createRegistry([HEARTWARMING_REDEMPTION_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Heartwarming Redemption', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const kept = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, kept };
}

describe('Heartwarming Redemption', () => {
  test('discards n, draws n+1, gains n+1', () => {
    const { g, kept } = redeemed();
    expect(kept).toBeGreaterThan(0);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(kept + 1);
    expect(g.state.players['p1']?.life).toBe(40 + kept + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HEARTWARMING_REDEMPTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HEARTWARMING_REDEMPTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HEARTWARMING_REDEMPTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = redeemed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
