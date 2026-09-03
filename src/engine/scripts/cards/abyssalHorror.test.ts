// `Abyssal Horror` — its entry aims at a player, who then chooses two cards
// of their hand to discard; a one-card hand loses that one card; an empty
// hand is asked nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ABYSSAL_HORROR_SCRIPT } from './abyssalHorror';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HORROR = 'Abyssal Horror';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function trimHand(g: Game, player: string, keep: number): void {
  const hand = idsIn(g, player, 'hand');
  for (const id of hand.slice(keep)) {
    must(g.submit({ t: 'ManualMoveCard', player, card: id, to: { kind: 'graveyard', player } }));
  }
}

function landed(theirHand: number | null): { g: Game; horror: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[HORROR], []],
    scripts: createRegistry([ABYSSAL_HORROR_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  if (theirHand !== null) trimHand(g, 'p2', theirHand);
  const logAt = g.log.length;
  const horror = put(g, 'p1', HORROR);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  return { g, horror, logAt };
}

describe('Abyssal Horror', () => {
  test('the opponent chooses two cards of their hand to discard', () => {
    const { g } = landed(null);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = idsIn(g, 'p2', 'hand');
    expect(hand.length).toBeGreaterThanOrEqual(2);
    const chosen = hand.slice(0, 2);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: chosen }));
    settle(g);
    for (const id of chosen) expect(g.state.cards[id]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(idsIn(g, 'p2', 'hand').length).toBe(hand.length - 2);
  });

  test('a one-card hand: the ask is for one', () => {
    const { g } = landed(1);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'chooseFromZone' && awaiting.count).toBe(1);
    const [only] = idsIn(g, 'p2', 'hand') as [InstanceId];
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [only] }));
    settle(g);
    expect(idsIn(g, 'p2', 'hand').length).toBe(0);
  });

  test('an empty hand is asked nothing', () => {
    const { g, logAt } = landed(0);
    settle(g);
    const asks = g.log.slice(logAt).filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting !== null && e.body.awaiting.kind === 'chooseFromZone');
    expect(asks.length).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g } = landed(null);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = idsIn(g, 'p2', 'hand');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: hand.slice(0, 2) }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
