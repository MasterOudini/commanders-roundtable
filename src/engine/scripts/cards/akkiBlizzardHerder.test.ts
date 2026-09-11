// `Akki Blizzard-Herder` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { AKKI_BLIZZARD_HERDER_SCRIPT } from './akkiBlizzardHerder';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Akki Blizzard-Herder";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; queueFodderL0_dies: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Akki Blizzard-Herder", "Forest"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([AKKI_BLIZZARD_HERDER_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const queueFodderL0_dies = put(g, 'p1', "Forest");
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
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, queueFodderL0_dies };
}

describe("Akki Blizzard-Herder", () => {
  test("When this creature dies: the vocabulary resolves \"Each player sacrifices a land of their choice.\"", () => {
    const { g, board0, queueFodderL0_dies } = armed(0);
    for (let qi = 0; qi < 4; qi++) {
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null), 20_000);
      const qa = g.state.priority.awaiting;
      if (qa?.kind !== 'chooseFromZone' || qa.zone !== 'battlefield') break;
      if (qa.player === 'p1') { must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [queueFodderL0_dies] })); continue; }
      let qDone = false;
      for (const qc of g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === qa.player)) {
        if (g.submit({ t: 'AnswerChooseFromZone', player: qa.player, cards: [qc] }).ok) { qDone = true; break; }
      }
      expect(qDone, 'the queued sacrifice could be answered for ' + qa.player).toBe(true);
    }
    settle(g);
    expect(g.state.pendingAsks).toBeNull();
    expect(g.state.cards[queueFodderL0_dies]?.zone.kind).toBe('graveyard');
    expect(onBoard(g)).toBe(board0 + -1 - 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
