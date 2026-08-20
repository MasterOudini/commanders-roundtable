// `Phyrexian Debaser` — taps, dies, and the target shrinks by two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PHYREXIAN_DEBASER_SCRIPT } from './phyrexianDebaser';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function debased(): { g: Game; debaser: string; victim: string } {
  const g = startedGame({
    players: 2,
    decks: [['Phyrexian Debaser'], ['Grizzly Bears']],
    scripts: createRegistry([PHYREXIAN_DEBASER_SCRIPT]),
  });
  const debaser = put(g, 'p1', 'Phyrexian Debaser');
  const victim = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: debaser,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, debaser, victim };
}

describe('Phyrexian Debaser', () => {
  test('the sacrifice pays and the 2/2 dies at -2/-2', () => {
    const { g, debaser, victim } = debased();
    expect(g.state.cards[debaser]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = debased();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
