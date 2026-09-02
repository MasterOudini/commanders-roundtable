// `Supply Drop` — the entry aims +2/+2 at my creature until cleanup; it can
// be cast on the opponent's turn (Flash is the engine's); four mana, the
// tap and the Drop buy a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUPPLY_DROP_SCRIPT } from './supplyDrop';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DROP = 'Supply Drop';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([SUPPLY_DROP_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function dropped(): { g: Game; drop: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DROP, BEARS], []],
    scripts: createRegistry([SUPPLY_DROP_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  const drop = put(g, 'p1', DROP);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, drop, bears };
}

describe('Supply Drop', () => {
  test('entering is +2/+2 on my bear until cleanup', () => {
    const { g, bears } = dropped();
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 4 });
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, bears)).toEqual({ power: 2, toughness: 2 });
  });

  test('{4}, {T}, sacrifice: a card, the Drop gone', () => {
    const { g, drop } = dropped();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: drop, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[drop]?.zone.kind).toBe('graveyard');
  });

  test("it is cast on the opponent's turn (Flash is the engine's) and still aims", () => {
    const g = startedGame({
      players: 2,
      decks: [[DROP, BEARS], []],
      scripts: createRegistry([SUPPLY_DROP_SCRIPT]),
    });
    const bears = put(g, 'p1', BEARS);
    settle(g);
    holdEverywhere(g);
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null,
      60_000,
    );
    const drop = put(g, 'p1', DROP, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: drop }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[drop]?.zone.kind).toBe('battlefield');
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 4 });
  });

  test('replays to the same hash', () => {
    const { g, drop } = dropped();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: drop, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
