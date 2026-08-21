// `Sinister Hideout` — the paid surveil at #a1: the ask rides toGraveyard,
// so the declined card falls into the graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SINISTER_HIDEOUT_SCRIPT } from './sinisterHideout';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function surveilled(toGrave: boolean): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sinister Hideout'], []],
    scripts: createRegistry([SINISTER_HIDEOUT_SCRIPT]),
  });
  const land = put(g, 'p1', 'Sinister Hideout');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const top = lib[lib.length - 1];
  if (top === undefined) throw new Error('empty library');
  must(
    g.submit(
      toGrave
        ? { t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }
        : { t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] },
    ),
  );
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return g;
}

describe('Sinister Hideout', () => {
  test('declining the top card puts it into the graveyard', () => {
    const g = surveilled(true);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(1);
  });

  test('keeping it costs nothing', () => {
    const g = surveilled(false);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = surveilled(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
