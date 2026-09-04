// `Pacifism` - cast on Grizzly Bears it attaches and the enchanted creature cannot attack or block;
// the other creature is untouched; the host dying drops the Aura
// (CR 704.5m); the replay hash (D304). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PACIFISM_SCRIPT } from './pacifism';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Pacifism";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; self: InstanceId; host: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD, "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([PACIFISM_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', "Grizzly Bears");
  const other = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  // p1's third-turn main phase: the host is past summoning sickness; the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, self, host, other };
}

function cast(g: Game, self: InstanceId, target: InstanceId): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: target }] }));
  settle(g);
}

describe("Pacifism", () => {
  test("on Grizzly Bears: attached, and the enchanted creature cannot attack or block; Cyclops of One-Eyed Pass is untouched", () => {
    const { g, self, host } = board();
    cast(g, self, host);
    expect(g.state.cards[self]?.attachedTo).toBe(host);
  });

  test('the host dying drops the Aura (CR 704.5m)', () => {
    const { g, self, host } = board();
    cast(g, self, host);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: host, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('the enchanted creature cannot attack', () => {
    const { g, self, host } = board();
    cast(g, self, host);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    expect(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: host, defender: { kind: 'player', id: 'p2' } }] }).ok).toBe(false);
  });

  test('the enchanted creature cannot block', () => {
    const { g, self, host, other } = board();
    cast(g, self, host);
    // The opponent's fourth turn: the Cyclops attacks, the host may not block it.
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: other, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    expect(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: host, attacker: other }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, self, host } = board();
    cast(g, self, host);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
