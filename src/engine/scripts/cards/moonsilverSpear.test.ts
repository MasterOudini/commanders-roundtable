// `Moonsilver Spear` - equipped to Grizzly Bears the creature has firstStrike; (on the equipped creature attacking: 1 token); the Cyclops is untouched;
// equipping again moves it; the opponent's creature is no legal host; the Equip is
// sorcery-speed; the host dying leaves it unattached (CR 704.5n); the replay hash (D305).
// Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOONSILVER_SPEAR_SCRIPT } from './moonsilverSpear';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Moonsilver Spear";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([MOONSILVER_SPEAR_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function board(): { g: Game; self: InstanceId; host: InstanceId; second: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD, "Grizzly Bears", "Coral Eel"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([MOONSILVER_SPEAR_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const host = put(g, 'p1', "Grizzly Bears");
  const second = put(g, 'p1', "Coral Eel");
  const other = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  // p1's third-turn main phase: sorcery speed, the creatures past summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, self, host, second, other };
}

function equip(g: Game, self: InstanceId, target: InstanceId): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, targets: [{ kind: 'card', id: target }] }));
  settle(g);
}

describe("Moonsilver Spear", () => {
  test("equipped to Grizzly Bears: attached, and the creature has firstStrike; (on the equipped creature attacking: 1 token); the Cyclops is untouched", () => {
    const { g, self, host, other } = board();
    equip(g, self, host);
    expect(g.state.cards[self]?.attachedTo).toBe(host);
    expect(kw(g, host).has("firstStrike")).toBe(true);
    expect(kw(g, other).has("firstStrike")).toBe(false);
  });

  test('equipping again moves it', () => {
    const { g, self, host, second } = board();
    equip(g, self, host);
    equip(g, self, second);
    expect(g.state.cards[self]?.attachedTo).toBe(second);
    expect(kw(g, host).has("firstStrike")).toBe(false);
  });

  test('the opponent creature is no legal host', () => {
    const { g, self, other } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, targets: [{ kind: 'card', id: other }] }).ok).toBe(false);
  });

  test('sorcery speed: refused on the opponent turn', () => {
    const { g, self, host } = board();
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, targets: [{ kind: 'card', id: host }] }).ok).toBe(false);
  });

  test('the host dying leaves the Equipment on the battlefield, unattached (CR 704.5n)', () => {
    const { g, self, host } = board();
    equip(g, self, host);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: host, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[self]?.attachedTo).toBeNull();
  });

  test("the equipped creature attacking: (on the equipped creature attacking: 1 token)", () => {
    const { g, self, host } = board();
    equip(g, self, host);
    const board0 = onBoard(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: host, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test('replays to the same hash', () => {
    const { g, self, host } = board();
    equip(g, self, host);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
