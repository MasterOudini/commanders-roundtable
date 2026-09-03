// `Opposition` — my untapped Bears pays (D286's chooser) to tap their land;
// a player is refused (the list names no player).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OPPOSITION_SCRIPT } from './opposition';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Opposition';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; mine: InstanceId; theirs: InstanceId; island: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS], [BEARS, 'Island']], scripts: createRegistry([OPPOSITION_SCRIPT]) });
  const self = put(g, 'p1', CARD);
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  const island = put(g, 'p2', 'Island');
  settle(g);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, tap: [mine] }));
  return { g, mine, theirs, island };
}

describe('Opposition', () => {
  test('my Bears taps to tap their land', () => {
    const { g, mine, island } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: island }] }));
    settle(g);
    expect(g.state.cards[mine]?.tapped).toBe(true);
    expect(g.state.cards[island]?.tapped).toBe(true);
  });

  test('their creature is a legal target too; a player is refused', () => {
    const { g, theirs } = placed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, island } = placed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: island }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
