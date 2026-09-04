// `Ghen, Arcanum Weaver` - the named target is accepted and it returns to the battlefield; a permanent the adjective excludes
// is refused (D294). Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GHEN_ARCANUM_WEAVER_SCRIPT } from './ghenArcanumWeaver';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Ghen, Arcanum Weaver";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; wrong: InstanceId; life0: number; fodder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Ghen, Arcanum Weaver", "Deathgrip", "Grizzly Bears", "Hissing Miasma"], ["Grizzly Bears"]],
    scripts: createRegistry([GHEN_ARCANUM_WEAVER_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p1', "Deathgrip", 'graveyard');
  const wrong = put(g, 'p1', "Grizzly Bears", 'graveyard');
  const fodder = put(g, 'p1', "Hissing Miasma");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder }));
  return { g, self, target, wrong, life0, fodder };
}

describe("Ghen, Arcanum Weaver", () => {
  test("Deathgrip is a legal target and it returns to the battlefield", () => {
    const { g, self, target, fodder } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(g.state.cards[target]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[target]?.controller).toBe('p1');
    expect(g.state.cards[self]?.tapped).toBe(true);
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
  });

  test("Grizzly Bears is refused (D294)", () => {
    const { g, wrong } = armed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wrong }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, target } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
