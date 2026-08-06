// `Faerie Duelist` — the -2/-0 lands on an opponent's creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FAERIE_DUELIST_SCRIPT } from './faerieDuelist';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DUELIST = 'Faerie Duelist';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entering(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DUELIST], [BEARS]],
    scripts: createRegistry([FAERIE_DUELIST_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  put(g, 'p1', DUELIST);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, theirs };
}

describe('Faerie Duelist', () => {
  test('the -2/-0 lands as the layer-7c modifier', () => {
    const { g, theirs } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === theirs &&
          e.body.power === -2 &&
          e.body.toughness === 0,
      ),
    ).toBe(true);
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, theirs } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
