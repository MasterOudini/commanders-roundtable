// `Tempestra, Dame of Games` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { TEMPESTRA_DAME_OF_GAMES_SCRIPT } from './tempestraDameOfGames';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Tempestra, Dame of Games";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; tok0: readonly InstanceId[]; vtA0_0: InstanceId; fodder0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([TEMPESTRA_DAME_OF_GAMES_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function tokensMade(g: Game, before: readonly InstanceId[]): InstanceId[] {
  return Object.values(g.state.cards).filter((c) => c.isToken === true && c.zone.kind === 'battlefield' && c.controller === 'p1' && !before.includes(c.id)).map((c) => c.id);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Tempestra, Dame of Games", "Sol Ring", "Cyclops of One-Eyed Pass"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([TEMPESTRA_DAME_OF_GAMES_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtA0_0 = put(g, 'p1', "Cyclops of One-Eyed Pass");
  const fodder0 = [put(g, 'p1', "Sol Ring")];
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const tok0 = Object.values(g.state.cards).filter((c) => c.isToken === true && c.zone.kind === 'battlefield' && c.controller === 'p1').map((c) => c.id);
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0.slice(0, 1) }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtA0_0 }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, tok0, vtA0_0, fodder0 };
}

describe("Tempestra, Dame of Games", () => {
  test("{2}{R}, {T}, Sacrifice an artifact: the vocabulary resolves \"Create a token that's a copy of another target creature you control, except it isn't legendary. It gains haste. Sacrifice it at the beginning of the next end step.\"", () => {
    const { g, self, board0, tok0, fodder0 } = armed(0);
    const made = tokensMade(g, tok0);
    expect(made, 'the tokens the fire made').toHaveLength(1);
    for (const id of made) expect(kw(g, id).has("haste"), "gained haste").toBe(true);
    for (const id of made) expect(g.state.cards[id]?.gained, 'without a printed duration the grant rides the object').toContain("haste");
    expect(onBoard(g)).toBe(board0 + 1 - 1);
    expect(g.state.delayedTriggers.length, 'the payload is armed, not run').toBe(1);
    { const boardD = onBoard(g);
      advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === "end", 40_000);
      settle(g);
      expect(onBoard(g), "the board after the step").toBe(boardD + -1);
      for (const id of made) expect(g.state.cards[id]?.zone.kind, "sacrificeObj at the step").not.toBe('battlefield');
    }
    expect(g.state.delayedTriggers.length, 'every entry fired').toBe(0);
    expect(g.state.cards[self]?.tapped).toBe(true);
    for (const f of fodder0.slice(0, 1)) expect(g.state.cards[f]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
