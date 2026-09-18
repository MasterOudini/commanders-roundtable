// `Call of the Wild` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { CALL_OF_THE_WILD_SCRIPT } from './callOfTheWild';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Call of the Wild";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Call of the Wild", "Grizzly Bears", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([CALL_OF_THE_WILD_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    const lookPicksA0 = (Object.keys(g.state.cards) as InstanceId[]).filter((id) => nameOf(g, id) === "Grizzly Bears" && (g.state.cards[id]?.zone.kind === 'library' || g.state.cards[id]?.zone.kind === 'hand'));
    expect(lookPicksA0.length, "Grizzly Bears is dealt for the look").toBeGreaterThan(0);
    for (const id of lookPicksA0) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Call of the Wild", () => {
  test("{2}{G}{G}: the vocabulary resolves \"Reveal the top card of your library. If it's a creature card, put it onto the battlefield. Otherwise, put it into your graveyard.\"", () => {
    const { g } = armed(0);
    settle(g);
    { let from = 0; g.log.forEach((ev, i) => { if (ev.body.t === 'CardsMoved' && ev.body.moves.some((m) => m.to.kind === 'library' && nameOf(g, m.card) === "Grizzly Bears")) from = i + 1; });
      const moved = g.log.slice(from).flatMap((ev) => (ev.body.t === 'CardsMoved' ? ev.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === "battlefield" && nameOf(g, m.card) === "Grizzly Bears") : []));
      expect(moved.length, "Grizzly Bears goes onto the battlefield unprompted").toBe(1);
      for (const m of moved) expect(g.state.cards[m.card]?.zone.kind).toBe("battlefield");
      for (const m of moved) expect(g.state.cards[m.card]?.revealedTo).toEqual([]);
      expect(g.state.priority.awaiting).toBeNull();
    }
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
