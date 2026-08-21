// `Soulquake` — both zones empty at once: battlefield creatures AND
// graveyard creature cards to their owners' hands; a land stays put in each.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOULQUAKE_SCRIPT } from './soulquake';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function quaked(): {
  g: Game;
  mine: InstanceId;
  theirs: InstanceId;
  dead: InstanceId;
  land: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [
      ['Soulquake', 'Grizzly Bears', 'Swamp'],
      ['Grizzly Bears', 'Grizzly Bears'],
    ],
    scripts: createRegistry([SOULQUAKE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const dead = put(g, 'p2', 'Grizzly Bears', 'graveyard');
  const land = put(g, 'p1', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Soulquake', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, dead, land };
}

describe('Soulquake', () => {
  test('battlefield and graveyard creatures go home; the land stands', () => {
    const { g, mine, theirs, dead, land } = quaked();
    expect(g.state.cards[mine]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.cards[dead]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = quaked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
