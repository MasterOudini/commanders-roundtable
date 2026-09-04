// `Spider-Man 2099, Miguel O'Hara` - entering bounces the declared creature (or
// nothing); an unblocked attack draws exactly one card; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPIDER_MAN2099_SCRIPT } from './spiderMan2099';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Spider-Man 2099, Miguel O'Hara";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entering(): { g: Game; self: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD], [BEARS]], scripts: createRegistry([SPIDER_MAN2099_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, self, bears };
}

function attacking(): { g: Game; handBefore: number } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS, BEARS, BEARS], [BEARS]], scripts: createRegistry([SPIDER_MAN2099_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  // Entering asks for its optional target; none is declared.
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  const handBefore = (g.state.zones.hand.p1 ?? []).length;
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
  // Unblocked: the damage step fires the draw, which resolves inside settle().
  settle(g);
  advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' || s.turn.turnNumber > 3, 20_000);
  return { g, handBefore };
}

describe('Spider-Man 2099, Miguel O\'Hara', () => {
  test('entering returns the declared creature to hand', () => {
    const { g, bears } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
  });

  test('entering with no target declared bounces nothing', () => {
    const { g, bears } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('an unblocked attack draws exactly one card', () => {
    const { g, handBefore } = attacking();
    expect((g.state.zones.hand.p1 ?? []).length).toBe(handBefore + 1);
  });

  test('replays to the same hash', () => {
    const { g } = attacking();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
