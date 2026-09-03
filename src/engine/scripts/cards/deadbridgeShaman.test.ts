// `Deadbridge Shaman` — when it dies, the target opponent chooses a card of
// their hand to discard; leaving for exile is not dying.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEADBRIDGE_SHAMAN_SCRIPT } from './deadbridgeShaman';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SHAMAN = 'Deadbridge Shaman';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; shaman: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SHAMAN], []],
    scripts: createRegistry([DEADBRIDGE_SHAMAN_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const shaman = put(g, 'p1', SHAMAN);
  settle(g);
  return { g, shaman };
}

describe('Deadbridge Shaman', () => {
  test('dying: the opponent chooses a card of their hand to discard', () => {
    const { g, shaman } = placed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: shaman, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = idsIn(g, 'p2', 'hand');
    const chosen = hand[0] as string;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [chosen] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(idsIn(g, 'p2', 'hand').length).toBe(hand.length - 1);
  });

  test('exile is not dying: no ask', () => {
    const { g, shaman } = placed();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: shaman, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    const asks = g.log.slice(logAt).filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting !== null && e.body.awaiting.kind === 'chooseTargets');
    expect(asks.length).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g, shaman } = placed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: shaman, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = idsIn(g, 'p2', 'hand');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [hand[0] as string] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
