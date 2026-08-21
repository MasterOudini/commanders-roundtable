// `Retribution of the Meek` — power 4 dies, power 2 lives, and an
// indestructible 4-power survives its own bar.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RETRIBUTION_OF_THE_MEEK_SCRIPT } from './retributionOfTheMeek';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; titan: InstanceId; bears: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Retribution of the Meek', 'Grave Titan', 'Grizzly Bears', 'Darksteel Myr'], []],
    scripts: createRegistry([RETRIBUTION_OF_THE_MEEK_SCRIPT]),
  });
  const titan = put(g, 'p1', 'Grave Titan');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const myr = put(g, 'p1', 'Darksteel Myr');
  // Four +1/+1 counters make the indestructible Myr a 4/5 — ON the bar.
  must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: myr, kind: '+1/+1', delta: 4 }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Retribution of the Meek', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, titan, bears, myr };
}

describe('Retribution of the Meek', () => {
  test('power 4+ dies; small and indestructible both stand', () => {
    const { g, titan, bears, myr } = board();
    expect(g.state.cards[titan]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
