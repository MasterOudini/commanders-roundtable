// `Path of Peace` — Misfortune's Gain's printed line under a cheaper cost.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PATH_OF_PEACE_SCRIPT } from './pathOfPeace';
import { MISFORTUNE_S_GAIN, PATH_OF_PEACE } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pathed(): { g: Game; bears: string } {
  const g = startedGame({
    players: 2,
    decks: [['Path of Peace'], ['Grizzly Bears']],
    scripts: createRegistry([PATH_OF_PEACE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Path of Peace', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['W', 'C', 'C', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  return { g, bears };
}

describe('Path of Peace', () => {
  test('shares its printed text with Misfortune s Gain', () => {
    expect(PATH_OF_PEACE.faces[0]?.oracleText).toBe(MISFORTUNE_S_GAIN.faces[0]?.oracleText);
  });

  test('destroys the creature and pays its owner 4 life', () => {
    const { g, bears } = pathed();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const { g } = pathed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
