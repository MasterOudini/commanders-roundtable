// `Stronghold Assassin` - the named target is accepted and it is destroyed; a permanent the adjective excludes
// is refused (D294). Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STRONGHOLD_ASSASSIN_SCRIPT } from './strongholdAssassin';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Stronghold Assassin";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; wrong: InstanceId; life0: number; fodder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Stronghold Assassin", "Grizzly Bears"], ["Grizzly Bears", "Vampire Nighthawk"]],
    scripts: createRegistry([STRONGHOLD_ASSASSIN_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const target = put(g, 'p2', "Grizzly Bears");
  const wrong = put(g, 'p2', "Vampire Nighthawk");
  const fodder = put(g, 'p1', "Grizzly Bears");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder }));
  return { g, self, target, wrong, life0, fodder };
}

describe("Stronghold Assassin", () => {
  test("Grizzly Bears is a legal target and it is destroyed", () => {
    const { g, self, target, fodder } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[self]?.tapped).toBe(true);
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
  });

  test("Vampire Nighthawk is refused (D294)", () => {
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
