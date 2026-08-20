// `Phyrexian Defiler` — taps, dies, and the target shrinks by three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PHYREXIAN_DEFILER_SCRIPT } from './phyrexianDefiler';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function defiled(): { g: Game; defiler: string; victim: string } {
  const g = startedGame({
    players: 2,
    decks: [['Phyrexian Defiler'], ['Grizzly Bears']],
    scripts: createRegistry([PHYREXIAN_DEFILER_SCRIPT]),
  });
  const defiler = put(g, 'p1', 'Phyrexian Defiler');
  const victim = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: defiler,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, defiler, victim };
}

describe('Phyrexian Defiler', () => {
  test('the sacrifice pays and the 2/2 dies at -3/-3', () => {
    const { g, defiler, victim } = defiled();
    expect(g.state.cards[defiler]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = defiled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
