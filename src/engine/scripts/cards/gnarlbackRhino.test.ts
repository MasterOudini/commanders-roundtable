// `Gnarlback Rhino` — MY spell aimed at the Rhino draws; aimed elsewhere,
// or an OPPONENT'S spell at the Rhino, nothing (the caster filter Fugitive
// Druid deliberately lacks).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GNARLBACK_RHINO_SCRIPT } from './gnarlbackRhino';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const RHINO = 'Gnarlback Rhino';
const BOLT = 'Lightning Bolt';
const AURA = 'Pacifism';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; rhino: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[RHINO, BOLT, BEARS], [AURA]],
    scripts: createRegistry([GNARLBACK_RHINO_SCRIPT]),
  });
  const rhino = put(g, 'p1', RHINO);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  return { g, rhino, bears };
}

describe('Gnarlback Rhino', () => {
  test('my spell aimed AT the Rhino draws me a card', () => {
    const { g, rhino } = board();
    const bolt = put(g, 'p1', BOLT, 'hand');
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: rhino }] }));
    settle(g);
    // −1 for the cast Bolt, +1 for the draw: net unchanged.
    expect(idsIn(g, 'p1', 'hand').length).toBe(before);
  });

  test('my spell aimed at ANOTHER creature pays nothing', () => {
    const { g, bears } = board();
    const bolt = put(g, 'p1', BOLT, 'hand');
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before - 1);
  });

  test("an OPPONENT'S spell at the Rhino pays nothing — the caster filter holds", () => {
    const { g, rhino } = board();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
    const aura = put(g, 'p2', AURA, 'hand');
    const mine = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p2', card: aura }));
    must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id: rhino }] }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(mine);
  });

  test('replays to the same hash', () => {
    const { g, rhino } = board();
    const bolt = put(g, 'p1', BOLT, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: rhino }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
