// `Marker Beetles` — the sacrifice draws a card and, through the dies
// watcher it fires, aims a +1/+1 pump; a plain death aims the pump alone.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MARKER_BEETLES_SCRIPT } from './markerBeetles';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BEETLES = 'Marker Beetles';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function board(): { g: Game; beetles: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BEETLES, BEARS], []],
    scripts: createRegistry([MARKER_BEETLES_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const beetles = put(g, 'p1', BEETLES);
  settle(g);
  holdEverywhere(g);
  return { g, beetles, bears };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([MARKER_BEETLES_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Marker Beetles', () => {
  test('{2}, sacrifice: a card, and the death aims a +1/+1', () => {
    const { g, beetles, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: beetles, abilityIndex: 0, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[beetles]?.zone.kind).toBe('graveyard');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(pt(g, bears)).toEqual({ power: 3, toughness: 3 });
  });

  test('a plain death aims the pump alone', () => {
    const { g, beetles, bears } = board();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: beetles, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(pt(g, bears)).toEqual({ power: 3, toughness: 3 });
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g, beetles, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: beetles, abilityIndex: 0, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
