// `Subjugate the Hobbits` — the cheap creature changes hands; the mana
// value 6 Titan does not, and neither does a COMMANDER.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUBJUGATE_THE_HOBBITS_SCRIPT } from './subjugateTheHobbits';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function subjugated(): { g: Game; cheap: InstanceId; titan: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Subjugate the Hobbits'], ['Grizzly Bears', 'Grave Titan']],
    scripts: createRegistry([SUBJUGATE_THE_HOBBITS_SCRIPT]),
  });
  const cheap = put(g, 'p2', 'Grizzly Bears');
  const titan = put(g, 'p2', 'Grave Titan');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Subjugate the Hobbits', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 7 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, cheap, titan };
}

describe('Subjugate the Hobbits', () => {
  test('the mana-value-2 creature changes hands; the 6-drop stays', () => {
    const { g, cheap, titan } = subjugated();
    expect(g.state.cards[cheap]?.controller).toBe('p1');
    expect(g.state.cards[titan]?.controller).toBe('p2');
  });

  test('replays to the same hash', () => {
    const { g } = subjugated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
