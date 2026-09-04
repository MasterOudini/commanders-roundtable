// `Aven Brigadier` - +1/+1 reaches the opponent's Bird and the controller's
// Soldier, not a Fish nor the Brigadier itself; both end when it leaves; replay
// equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AVEN_BRIGADIER_SCRIPT } from './avenBrigadier';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Aven Brigadier'; // Bird Soldier 3/5
const OWL = 'Augury Owl'; // Bird 1/1
const BEARER = 'Thraben Standard Bearer'; // Human Soldier 1/1
const EEL = 'Coral Eel'; // Fish 2/1

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([AVEN_BRIGADIER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function board(): { g: Game; self: InstanceId; owl: InstanceId; bearer: InstanceId; eel: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARER, EEL], [OWL]], scripts: createRegistry([AVEN_BRIGADIER_SCRIPT]) });
  holdEverywhere(g);
  const owl = put(g, 'p2', OWL);
  const bearer = put(g, 'p1', BEARER);
  const eel = put(g, 'p1', EEL);
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, owl, bearer, eel };
}

describe('Aven Brigadier', () => {
  test("the opponent's Bird and the controller's Soldier are reached; the Fish and the Brigadier are not", () => {
    const { g, self, owl, bearer, eel } = board();
    expect(pt(g, owl)).toEqual([2, 2]);
    expect(pt(g, bearer)).toEqual([2, 2]);
    expect(pt(g, eel)).toEqual([2, 1]);
    expect(pt(g, self)).toEqual([3, 5]);
  });

  test('both effects end when the source leaves the battlefield', () => {
    const { g, self, owl, bearer } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, owl)).toEqual([1, 1]);
    expect(pt(g, bearer)).toEqual([1, 1]);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
