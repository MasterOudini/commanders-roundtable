// `Aang's Defense` — on their turn my Bears blocks their attacker; the spell
// gives my BLOCKING Bears +2/+2 and draws me a card; my creature at home is
// refused (D291 + the D290 controller recursion).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AANGS_DEFENSE_SCRIPT } from './aangsDefense';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Aang's Defense";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; blocker: InstanceId; home: InstanceId; handBefore: number } {
  const g = startedGame({ players: 2, decks: [[SPELL, BEARS, BEARS, 'Island', 'Island', 'Island'], [BEARS]], scripts: createRegistry([AANGS_DEFENSE_SCRIPT]) });
  const blocker = put(g, 'p1', BEARS);
  const home = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: theirs, defender: { kind: 'player', id: 'p1' } }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker, attacker: theirs }] }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && (s.combat?.blockers.length ?? 0) > 0, 20_000);
  const handBefore = (g.state.zones.hand.p1 ?? []).length;
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, blocker, home, handBefore };
}

describe("Aang's Defense", () => {
  test('my blocking Bears gets +2/+2 and I draw', () => {
    const { g, blocker, handBefore } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: blocker }] }));
    settle(g);
    const d = deps(createRegistry([AANGS_DEFENSE_SCRIPT]));
    const got = derive(g.state, d.oracle, d.scripts, blocker);
    expect([got.power, got.toughness]).toEqual([4, 4]);
    // The spell left the hand (-1) and a card was drawn (+1).
    expect((g.state.zones.hand.p1 ?? []).length).toBe(handBefore);
  });

  test('my creature that is not blocking is refused (D291)', () => {
    const { g, home } = aimed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: home }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, blocker } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: blocker }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
