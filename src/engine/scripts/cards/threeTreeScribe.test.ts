// `Three Tree Scribe` — the leaves-WITHOUT-DYING watcher.
//
// ⚠️ The destination filter IS the card, so the case that proves it is the
// NEGATIVE: its own death — a battlefield→graveyard move, which every other
// leaves-watcher in the arc pays on — must pay NOTHING here.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THREE_TREE_SCRIBE_SCRIPT } from './threeTreeScribe';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SCRIBE = 'Three Tree Scribe';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; scribe: InstanceId; bears: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SCRIBE, BEARS, BEARS], []],
    scripts: createRegistry([THREE_TREE_SCRIBE_SCRIPT]),
  });
  const scribe = put(g, 'p1', SCRIBE);
  const bears = put(g, 'p1', BEARS);
  const other = put(g, 'p1', BEARS);
  if (bears === other) throw new Error('the deck must hold two distinct Bears');
  settle(g);
  return { g, scribe, bears, other };
}

/** Moves `card` to `to` and answers the trigger's aim at `aim` if one is raised. */
function leaveTo(g: Game, card: InstanceId, to: 'hand' | 'exile' | 'graveyard', aim: InstanceId): void {
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: to, player: 'p1' } }));
  if (g.state.priority.awaiting?.kind === 'chooseTargets') {
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: aim }] }));
  }
  settle(g);
}

describe('Three Tree Scribe', () => {
  test('a BOUNCE pays — leaving without dying', () => {
    const { g, scribe, bears, other } = game();
    leaveTo(g, bears, 'hand', other);
    expect(g.state.cards[other]?.counters['+1/+1']).toBe(1);
    expect(g.state.cards[scribe]?.zone.kind).toBe('battlefield');
  });

  test('an EXILE pays too — the filter is the destination, not the verb', () => {
    const { g, bears, other } = game();
    leaveTo(g, bears, 'exile', other);
    expect(g.state.cards[other]?.counters['+1/+1']).toBe(1);
  });

  test('DYING pays NOTHING — and its own death is the case that proves it', () => {
    const { g, scribe, bears, other } = game();
    leaveTo(g, bears, 'graveyard', other);
    expect(g.state.cards[other]?.counters['+1/+1']).toBeUndefined();
    // Now the Scribe itself, which is self-inclusive but still dies.
    leaveTo(g, scribe, 'graveyard', other);
    expect(g.state.cards[other]?.counters['+1/+1']).toBeUndefined();
  });

  test('replays to the same hash', () => {
    const { g, bears, other } = game();
    leaveTo(g, bears, 'hand', other);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
