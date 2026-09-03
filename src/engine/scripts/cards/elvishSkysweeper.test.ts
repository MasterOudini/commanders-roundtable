// `Elvish Skysweeper` — {4}{G} and a sacrificed Bears destroy their flyer;
// their ground creature is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELVISH_SKYSWEEPER_SCRIPT } from './elvishSkysweeper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Elvish Skysweeper';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; fodder: InstanceId; hawk: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS], [HAWK, BEARS]], scripts: createRegistry([ELVISH_SKYSWEEPER_SCRIPT]) });
  const self = put(g, 'p1', CARD);
  const fodder = put(g, 'p1', BEARS);
  const hawk = put(g, 'p2', HAWK);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder }));
  return { g, fodder, hawk, bears };
}

describe('Elvish Skysweeper', () => {
  test('the sacrificed Bears pays and the flyer dies', () => {
    const { g, fodder, hawk } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[fodder]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(g.state.cards[hawk]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
  });

  test('a ground creature is refused (D289)', () => {
    const { g, bears } = placed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, hawk } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
