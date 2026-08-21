// `Seeds of Innocence` — every artifact dies and each controller is paid
// its own mana values; the indestructible artifact LAND survives and
// pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEEDS_OF_INNOCENCE_SCRIPT } from './seedsOfInnocence';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function seeded(): { g: Game; mine: InstanceId; theirs: InstanceId; citadel: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Seeds of Innocence', 'Sol Ring', 'Darksteel Citadel'],
      ['Hedron Archive'],
    ],
    scripts: createRegistry([SEEDS_OF_INNOCENCE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Sol Ring');
  const citadel = put(g, 'p1', 'Darksteel Citadel');
  const theirs = put(g, 'p2', 'Hedron Archive');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Seeds of Innocence', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, citadel };
}

describe('Seeds of Innocence', () => {
  test('each controller is paid for its own dead artifacts; the Citadel survives', () => {
    const { g, mine, theirs, citadel } = seeded();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[citadel]?.zone.kind).toBe('battlefield');
    // Sol Ring mv 1 to me; Hedron Archive mv 4 to them.
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.players['p2']?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const { g } = seeded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
