// `Wave of Reckoning` — Solar Blaze's text on its own oracle id: the Bears
// die of their own power, the 0-power Wall stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WAVE_OF_RECKONING_SCRIPT } from './waveOfReckoning';
import { WAVE_OF_RECKONING } from '../../../data/fixtures/engineCards';
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
    decks: [['Wave of Reckoning', 'Wall of Omens'], ['Grizzly Bears']],
    scripts: createRegistry([WAVE_OF_RECKONING_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const wall = put(g, 'p1', 'Wall of Omens');
  settle(g);
  const spell = put(g, 'p1', 'Wave of Reckoning', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, wall };
}

describe('Wave of Reckoning', () => {
  test('the Bears die of their own power; the 0-power Wall stands', () => {
    const { g, bears, wall } = board();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[wall]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WAVE_OF_RECKONING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WAVE_OF_RECKONING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WAVE_OF_RECKONING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
