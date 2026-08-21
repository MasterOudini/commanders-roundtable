// `Rottenheart Ghoul` — dying aims the trigger; the chosen player
// answers the discard ask.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROTTENHEART_GHOUL_SCRIPT } from './rottenheartGhoul';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Rottenheart Ghoul'], []],
    scripts: createRegistry([ROTTENHEART_GHOUL_SCRIPT]),
  });
  const ghoul = put(g, 'p1', 'Rottenheart Ghoul');
  settle(g);
  holdEverywhere(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: ghoul,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 60_000);
  return g;
}

describe('Rottenheart Ghoul', () => {
  test('the target answers and loses the card', () => {
    const g = died();
    const hand = g.state.zones.hand['p2'] ?? [];
    const before = hand.length;
    const pick = hand[0] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [pick] }));
    settle(g);
    expect(g.state.cards[pick]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before - 1);
  });

  test('replays to the same hash', () => {
    const g = died();
    const pick = (g.state.zones.hand['p2'] ?? [])[0] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [pick] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
