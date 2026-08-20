// `Gaze of Adamaro` — damage to the target player equal to THEIR hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GAZE_OF_ADAMARO_SCRIPT } from './gazeOfAdamaro';
import { GAZE_OF_ADAMARO } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gazed(): { g: Game; theirHand: number; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Gaze of Adamaro'], ['Grizzly Bears']],
    scripts: createRegistry([GAZE_OF_ADAMARO_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Gaze of Adamaro', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  const theirHand = (g.state.zones.hand['p2'] ?? []).length;
  const before = g.state.players['p2']?.life ?? 0;
  settle(g);
  return { g, theirHand, before };
}

describe('Gaze of Adamaro', () => {
  test("the damage equals the target's hand size at resolution", () => {
    const { g, theirHand, before } = gazed();
    expect(theirHand).toBeGreaterThan(0);
    expect(g.state.players['p2']?.life).toBe(before - theirHand);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GAZE_OF_ADAMARO.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GAZE_OF_ADAMARO.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GAZE_OF_ADAMARO.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = gazed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
