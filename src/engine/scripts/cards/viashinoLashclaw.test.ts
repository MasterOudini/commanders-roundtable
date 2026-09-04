// `Viashino Lashclaw` - the printed cost buys the pump until end of turn; it ends at cleanup;
// replay equal (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VIASHINO_LASHCLAW_SCRIPT } from './viashinoLashclaw';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Viashino Lashclaw";

type Armed = { g: Game; self: InstanceId; life0: number; yes: InstanceId; no: InstanceId; handCard: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([VIASHINO_LASHCLAW_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([VIASHINO_LASHCLAW_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Viashino Lashclaw", "Coral Eel", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([VIASHINO_LASHCLAW_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const yes = put(g, 'p1', "Coral Eel");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const handCard = put(g, 'p1', "Grizzly Bears", 'hand');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  if (which === 0) {
      must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, discard: [handCard] }));
    settle(g);
  }
  return { g, self, life0, yes, no, handCard };
}

describe("Viashino Lashclaw", () => {
  test("{T}, Discard a card: its controller's creatures gain haste until end of turn", () => {
    const { g, self, yes, no, handCard } = armed(0);
    expect(pt(g, yes)).toEqual([2, 1]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("haste")).toBe(true);
    expect(kw(g, no).has("haste")).toBe(false);
    expect(g.state.cards[self]?.tapped).toBe(true);
    expect(g.state.cards[handCard]?.zone.kind).toBe('graveyard');
  });

  test('the pump ends at cleanup', () => {
    const { g, yes } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(pt(g, yes)).toEqual([2, 1]);
    expect(kw(g, yes).has("haste")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
