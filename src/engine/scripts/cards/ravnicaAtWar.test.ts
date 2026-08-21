// `Ravnica at War` — the gold cards go to exile; monocolour and
// colourless stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAVNICA_AT_WAR_SCRIPT } from './ravnicaAtWar';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function warred(): { g: Game; gold: string; mono: string; ring: string } {
  const g = startedGame({
    players: 2,
    decks: [['Ravnica at War'], ['Baleful Strix', 'Grizzly Bears', 'Sol Ring']],
    scripts: createRegistry([RAVNICA_AT_WAR_SCRIPT]),
  });
  const gold = put(g, 'p2', 'Baleful Strix');
  const mono = put(g, 'p2', 'Grizzly Bears');
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  const spell = put(g, 'p1', 'Ravnica at War', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, gold, mono, ring };
}

describe('Ravnica at War', () => {
  test('the two-colour Strix is exiled; the Bears and Sol Ring stand', () => {
    const { g, gold, mono, ring } = warred();
    expect(g.state.cards[gold]?.zone.kind).toBe('exile');
    expect(g.state.cards[mono]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = warred();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
