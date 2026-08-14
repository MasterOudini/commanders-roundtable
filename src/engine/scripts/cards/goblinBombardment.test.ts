// `Goblin Bombardment` — the mana-free sacrifice chooser pays for a 1-damage
// ping at any target, through the staged chain.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_BOMBARDMENT_SCRIPT } from './goblinBombardment';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BOMBARDMENT = 'Goblin Bombardment';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; bombardment: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BOMBARDMENT, BEARS], []],
    scripts: createRegistry([GOBLIN_BOMBARDMENT_SCRIPT]),
  });
  const bombardment = put(g, 'p1', BOMBARDMENT);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, bombardment, bears };
}

describe('Goblin Bombardment', () => {
  test('the sacrificed creature pays for 1 damage to a player — no mana anywhere', () => {
    const { g, bombardment, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: bombardment,
        abilityIndex: 0,
        sacrifice: bears,
      }),
    );
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p2?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g, bombardment, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: bombardment,
        abilityIndex: 0,
        sacrifice: bears,
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
