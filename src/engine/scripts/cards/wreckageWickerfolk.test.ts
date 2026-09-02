// `Wreckage Wickerfolk` — flying plus an entry SURVEIL 2: a binned card
// reaches the graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WRECKAGE_WICKERFOLK_SCRIPT } from './wreckageWickerfolk';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WICKERFOLK = 'Wreckage Wickerfolk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; wickerfolk: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[WICKERFOLK], []],
    scripts: createRegistry([WRECKAGE_WICKERFOLK_SCRIPT]),
  });
  const wickerfolk = put(g, 'p1', WICKERFOLK);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, wickerfolk, revealed };
}

describe('Wreckage Wickerfolk', () => {
  test('the entry asks a SURVEIL 2 — toGraveyard', () => {
    const { g, revealed } = entered();
    expect(revealed).toHaveLength(2);
    expect(
      g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard,
    ).toBe(true);
  });

  test('a binned card reaches the GRAVEYARD', () => {
    const { g, revealed } = entered();
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
  });

  test('the Wickerfolk flies', () => {
    const { g, wickerfolk, revealed } = entered();
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [a, b], toBottom: [] }));
    settle(g);
    const d = deps(createRegistry([WRECKAGE_WICKERFOLK_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, wickerfolk).keywords.has('flying')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = entered();
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [a, b], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
