// `Havengul Runebinder` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { HAVENGUL_RUNEBINDER_SCRIPT } from './havengulRunebinder';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Havengul Runebinder";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; ownC0: number; selfC0: number; ownZombie: InstanceId; exg0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Havengul Runebinder", "Grizzly Bears", "Carrion Feeder"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([HAVENGUL_RUNEBINDER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const ownZombie = put(g, 'p1', "Carrion Feeder");
  const exg0 = [put(g, 'p1', "Grizzly Bears", 'graveyard')];
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
  let ownC0 = 0;
  let selfC0 = 0;
  if (which === 0) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    ownC0 = g.state.cards[ownZombie]?.counters["+1/+1"] ?? 0;
    selfC0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, exileFromGraveyard: exg0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, ownC0, selfC0, ownZombie, exg0 };
}

describe("Havengul Runebinder", () => {
  test("{2}{U}, {T}, Exile a creature card from your graveyard: the vocabulary resolves \"Create a 2/2 black Zombie creature token, then put a +1/+1 counter on each Zombie creature you control.\"", () => {
    const { g, self, no, board0, ownC0, ownZombie, exg0 } = armed(0);
    expect(g.state.cards[ownZombie]?.counters["+1/+1"] ?? 0, "a counter on the witness on your side").toBe(ownC0 + 1);
    expect(g.state.cards[no]?.counters["+1/+1"] ?? 0, "the opponent's creature outside the scope").toBe(0);
    expect(onBoard(g)).toBe(board0 + 1);
    expect(g.state.cards[self]?.tapped).toBe(true);
    for (const c of exg0) expect(g.state.cards[c]?.zone.kind).toBe('exile');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
