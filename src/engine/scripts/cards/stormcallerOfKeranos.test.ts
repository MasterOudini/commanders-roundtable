// `Stormcaller of Keranos` — the {1}{U} scry: no tap, so turn 1 works.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STORMCALLER_OF_KERANOS_SCRIPT } from './stormcallerOfKeranos';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function called(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Stormcaller of Keranos'], []],
    scripts: createRegistry([STORMCALLER_OF_KERANOS_SCRIPT]),
  });
  const caller = put(g, 'p1', 'Stormcaller of Keranos');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: caller, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const top = lib[lib.length - 1];
  if (top === undefined) throw new Error('empty library');
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  const after = g.state.zones.library['p1'] ?? [];
  if (after[0] !== top) throw new Error('the declined card must be on the bottom');
  return g;
}

describe('Stormcaller of Keranos', () => {
  test('the scry sends the top card to the bottom', () => {
    const g = called();
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const g = called();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
