// `Telim'Tor's Darts` — the player-or-planeswalker compound on the ACTIVATED
// path. An artifact taps the turn it arrives (CR 302.6 is about creatures).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TELIM_TORS_DARTS_SCRIPT } from './telimTorsDarts';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DARTS = "Telim'Tor's Darts";
const WALKER = 'Grist, the Hunger Tide';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; darts: InstanceId; walker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DARTS], [WALKER]],
    scripts: createRegistry([TELIM_TORS_DARTS_SCRIPT]),
  });
  const darts = put(g, 'p1', DARTS);
  const walker = put(g, 'p2', WALKER);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, darts, walker };
}

describe("Telim'Tor's Darts", () => {
  test('a player takes 1 and the Darts are spent', () => {
    const { g, darts } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: darts, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(39);
    expect(g.state.cards[darts]?.tapped).toBe(true);
  });

  // ⚠️ Damage to a planeswalker is MARKED and does not remove loyalty in
  // this engine (see tasteOfBlood.test.ts for the measurement).
  test('a PLANESWALKER is the other arm — the damage is marked, the player is untouched', () => {
    const { g, darts, walker } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: darts, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: walker }] }));
    settle(g);
    expect(g.state.cards[walker]?.damage).toBe(1);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g, darts } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: darts, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
