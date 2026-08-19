// `Man-o'-War` — the ETB bounce sends the target to its OWNER's hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MAN_OWAR_SCRIPT } from './manOWar';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const JELLYFISH = "Man-o'-War";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[JELLYFISH], ['Silvercoat Lion']],
    scripts: createRegistry([MAN_OWAR_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Silvercoat Lion');
  settle(g);
  const jelly = put(g, 'p1', JELLYFISH, 'graveyard');
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: jelly,
      to: { kind: 'battlefield', player: 'p1' },
    }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  return { g, theirs };
}

describe("Man-o'-War", () => {
  test("the bounced creature goes to its owner's hand", () => {
    const { g, theirs } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    const zone = g.state.cards[theirs]?.zone;
    expect(zone).toEqual({ kind: 'hand', player: 'p2' });
  });

  test('replays to the same hash', () => {
    const { g, theirs } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
