// `Ravenous Rats` — the targeted opponent chooses their own discard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAVENOUS_RATS_SCRIPT } from './ravenousRats';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ratted(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Ravenous Rats'], []],
    scripts: createRegistry([RAVENOUS_RATS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Ravenous Rats');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
  return g;
}

describe('Ravenous Rats', () => {
  test('the ask lands on the target and their pick goes to the graveyard', () => {
    const g = ratted();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'chooseFromZone' && awaiting.player).toBe('p2');
    const hand = g.state.zones.hand['p2'] ?? [];
    const before = hand.length;
    const pick = hand[0] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [pick] }));
    settle(g);
    expect(g.state.cards[pick]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before - 1);
  });

  test('replays to the same hash', () => {
    const g = ratted();
    const pick = (g.state.zones.hand['p2'] ?? [])[0] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [pick] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
