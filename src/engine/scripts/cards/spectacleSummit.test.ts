// `Spectacle Summit` — the paid surveil without a sacrifice: the land
// survives tapped.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPECTACLE_SUMMIT_SCRIPT } from './spectacleSummit';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function summited(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Spectacle Summit'], []],
    scripts: createRegistry([SPECTACLE_SUMMIT_SCRIPT]),
  });
  const land = put(g, 'p1', 'Spectacle Summit');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const top = lib[lib.length - 1];
  if (top === undefined) throw new Error('empty library');
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return { g, land };
}

describe('Spectacle Summit', () => {
  test('the declined card falls to the graveyard and the land survives', () => {
    const { g, land } = summited();
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(1);
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[land]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = summited();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
