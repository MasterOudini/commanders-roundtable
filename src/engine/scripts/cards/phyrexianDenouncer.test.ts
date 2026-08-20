// `Phyrexian Denouncer` — the -1/-1 Carrier takes exactly a 1/1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PHYREXIAN_DENOUNCER_SCRIPT } from './phyrexianDenouncer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function denounced(): { g: Game; denouncer: string; victim: string } {
  const g = startedGame({
    players: 2,
    decks: [['Phyrexian Denouncer'], ['Aysen Bureaucrats']],
    scripts: createRegistry([PHYREXIAN_DENOUNCER_SCRIPT]),
  });
  const denouncer = put(g, 'p1', 'Phyrexian Denouncer');
  const victim = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: denouncer,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, denouncer, victim };
}

describe('Phyrexian Denouncer', () => {
  test('the sacrifice pays and the 1/1 dies at -1/-1', () => {
    const { g, denouncer, victim } = denounced();
    expect(g.state.cards[denouncer]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = denounced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
