// `Fugitive Druid` — an Aura CAST at the Druid draws its controller a card,
// WHOEVER cast it; an Aura aimed elsewhere pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FUGITIVE_DRUID_SCRIPT } from './fugitiveDruid';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DRUID = 'Fugitive Druid';
const AURA = 'Pacifism';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; druid: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DRUID, AURA, BEARS], [AURA]],
    scripts: createRegistry([FUGITIVE_DRUID_SCRIPT]),
  });
  const druid = put(g, 'p1', DRUID);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, druid, bears };
}

describe('Fugitive Druid', () => {
  test('an Aura cast AT the Druid draws its controller a card', () => {
    const { g, druid } = board();
    const aura = put(g, 'p1', AURA, 'hand');
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: druid }] }));
    settle(g);
    // −1 for the cast Aura, +1 for the draw: net unchanged.
    expect(idsIn(g, 'p1', 'hand').length).toBe(before);
  });

  test('an Aura aimed at ANOTHER creature pays nothing', () => {
    const { g, bears } = board();
    const aura = put(g, 'p1', AURA, 'hand');
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before - 1);
  });

  test("an OPPONENT'S Aura cast at the Druid still pays the DRUID'S controller", () => {
    const { g, druid } = board();
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain',
      20_000,
    );
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
    const aura = put(g, 'p2', AURA, 'hand');
    const mine = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p2', card: aura }));
    must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id: druid }] }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(mine + 1);
  });

  test('replays to the same hash', () => {
    const { g, druid } = board();
    const aura = put(g, 'p1', AURA, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: druid }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
