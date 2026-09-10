// `Eloise, Nephalia Sleuth` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { ELOISE_NEPHALIA_SLEUTH_SCRIPT } from './eloiseNephaliaSleuth';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';
import { TOKEN_TABLE } from '../../../data/tokenTable';

const CARD = "Eloise, Nephalia Sleuth";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sacManaIndex(g: Game, id: InstanceId): number {
  const d = deps(createRegistry([ELOISE_NEPHALIA_SLEUTH_SCRIPT]));
  const inst = g.state.cards[id];
  const face = inst ? d.oracle.byPrinting(inst.printingId)?.faces[inst.faceIndex] : undefined;
  const p = face?.producesMana.find((m) => m.extraCost?.sacrificeSelf);
  if (!p) throw new Error('no mana ability whose price is its own sacrifice');
  return p.abilityIndex;
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Eloise, Nephalia Sleuth", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([ELOISE_NEPHALIA_SLEUTH_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: TOKEN_TABLE["Treasure|/||Artifact|"]?.printingId ?? '', count: 1 }));
  const sacTokAll = Object.values(g.state.cards).filter((c) => c.isToken && c.controller === 'p1').map((c) => c.id);
  const sacTok = sacTokAll[sacTokAll.length - 1];
  if (!sacTok) throw new Error('no sacrifice token made');
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    const bears = put(g, 'p1', "Grizzly Bears");
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'TapForMana', player: 'p1', card: sacTok, abilityIndex: sacManaIndex(g, sacTok), outputChoice: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library.p1 ?? [];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: lib.slice(lib.length - 1), toBottom: [] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0 };
}

describe("Eloise, Nephalia Sleuth", () => {
  test("Whenever another creature you control dies: 1 token made", () => {
    const { g, board0 } = armed(0);
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test("Whenever you sacrifice a token: surveil 1 asks, and the cards stay on top", () => {
    const { g, lib0 } = armed(1);
    expect(g.state.priority.awaiting).toBeNull();
    expect((g.state.zones.library.p1 ?? []).length).toBe(lib0);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
