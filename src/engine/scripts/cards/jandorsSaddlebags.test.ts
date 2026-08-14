// `Jandor's Saddlebags` — {3} and the tap straighten a chosen tapped
// creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JANDORS_SADDLEBAGS_SCRIPT } from './jandorsSaddlebags';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SADDLEBAGS = "Jandor's Saddlebags";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SADDLEBAGS, BEARS], []],
    scripts: createRegistry([JANDORS_SADDLEBAGS_SCRIPT]),
  });
  const saddlebags = put(g, 'p1', SADDLEBAGS);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: saddlebags, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe("Jandor's Saddlebags", () => {
  test('the tap untaps the chosen creature', () => {
    const { g, bears } = answered();
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = answered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
