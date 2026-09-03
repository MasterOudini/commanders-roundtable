// `Larder Zombie` — three untapped creatures tap for a surveil 1: the top
// card is shown and my answer sends it to the graveyard or keeps it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LARDER_ZOMBIE_SCRIPT } from './larderZombie';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ZOMBIE = 'Larder Zombie';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function surveiled(): { g: Game; shown: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[ZOMBIE, BEARS, NIGHTHAWK], []],
    scripts: createRegistry([LARDER_ZOMBIE_SCRIPT]),
  });
  const a = put(g, 'p1', BEARS);
  const b = put(g, 'p1', NIGHTHAWK);
  const zombie = put(g, 'p1', ZOMBIE);
  settle(g);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: zombie, abilityIndex: 0, tap: [zombie, a, b], targets: [] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const shown = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, shown };
}

describe('Larder Zombie (tap three, surveil 1)', () => {
  test('one card shown; sent away it goes to the graveyard', () => {
    const { g, shown } = surveiled();
    expect(shown.length).toBe(1);
    const [top] = shown as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
    settle(g);
    expect(g.state.cards[top]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
  });

  test('kept, it stays on top', () => {
    const { g, shown } = surveiled();
    const [top] = shown as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(top);
  });

  test('replays to the same hash', () => {
    const { g, shown } = surveiled();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [shown[0] as InstanceId] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
