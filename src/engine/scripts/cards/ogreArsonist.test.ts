// `Ogre Arsonist` — the entry burns the targeted land down.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OGRE_ARSONIST_SCRIPT } from './ogreArsonist';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burned(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Ogre Arsonist'], ['Mountain']],
    scripts: createRegistry([OGRE_ARSONIST_SCRIPT]),
  });
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Ogre Arsonist');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
  settle(g);
  return { g, land };
}

describe('Ogre Arsonist', () => {
  test('the entry destroys the targeted land', () => {
    const { g, land } = burned();
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = burned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
