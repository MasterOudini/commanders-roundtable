// `Ruinous Ultimatum` — the opponents' nonland board dies; their land
// and MY board stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RUINOUS_ULTIMATUM_SCRIPT } from './ruinousUltimatum';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ultimatumed(): {
  g: Game;
  bears: InstanceId;
  ring: InstanceId;
  land: InstanceId;
  maw: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [
      ['Ruinous Ultimatum', 'Colossal Dreadmaw'],
      ['Grizzly Bears', 'Sol Ring', 'Mountain'],
    ],
    scripts: createRegistry([RUINOUS_ULTIMATUM_SCRIPT]),
  });
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const ring = put(g, 'p2', 'Sol Ring');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Ruinous Ultimatum', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, ring, land, maw };
}

describe('Ruinous Ultimatum', () => {
  test('their creature and artifact die; their land and my board stand', () => {
    const { g, bears, ring, land, maw } = ultimatumed();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = ultimatumed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
