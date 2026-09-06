// D330 - REGENERATION (CR 701.19), the destroy half: a regeneration shield
// replaces a destroy effect (tapped, damage removed, out of combat, the shield
// spent) unless the spell says the creature can't be regenerated; the shield
// ends at cleanup. The lethal-damage half is proven by every generated
// regenerate suite (the Bolt).
import { describe, expect, test } from 'vitest';
import { createRegistry } from './scripts/registryCore';
import { DRUDGE_SKELETONS_SCRIPT } from './scripts/cards/drudgeSkeletons';
import { DAMNATION_SCRIPT } from './scripts/cards/damnation';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Drudge Skeletons on p1's third-turn main phase, shielded by its own "{B}: Regenerate Drudge Skeletons." */
function shielded(spell: string): { g: Game; self: InstanceId; no: InstanceId; card: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [['Drudge Skeletons', spell], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([DRUDGE_SKELETONS_SCRIPT, DAMNATION_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const self = put(g, 'p1', 'Drudge Skeletons');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const card = put(g, 'p1', spell, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  settle(g);
  expect(g.state.regenerationShields[self]).toBe(1);
  const life0 = g.state.players.p1?.life ?? 0;
  return { g, self, no, card, life0 };
}

describe('D330 - regeneration against a destroy effect', () => {
  test('Infernal Grasp: the shield is spent, the creature stays tapped and undamaged, the rest of the spell resolves', () => {
    const { g, self, card, life0 } = shielded('Infernal Grasp');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: self }] }));
    settle(g);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[self]?.tapped).toBe(true);
    expect(g.state.cards[self]?.damage).toBe(0);
    expect(g.state.regenerationShields[self] ?? 0).toBe(0);
    expect(g.state.players.p1?.life).toBe(life0 - 2);
  });

  test("Terminate: 'It can't be regenerated' skips the shield", () => {
    const { g, self, card } = shielded('Terminate');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: self }] }));
    settle(g);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
    // Leaving the battlefield takes the shield with it.
    expect(g.state.regenerationShields[self]).toBeUndefined();
  });

  // A scripted sweeper (Damnation, D-era hand script) moves the creatures itself
  // and never asks the shield - which is what "They can't be regenerated" means.
  // (Wrath of God is not a vehicle: "Destroy all creatures" is outside the
  // resolver's grammar, so the spell is manual and destroys nothing.)
  test("Damnation: 'They can't be regenerated' skips the shield too", () => {
    const { g, self, no, card } = shielded('Damnation');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[no]?.zone.kind).toBe('graveyard');
    expect(g.state.regenerationShields).toEqual({});
  });

  test('the shield ends at cleanup (CR 701.19a: this turn)', () => {
    const { g, self } = shielded('Infernal Grasp');
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 20_000);
    expect(g.state.regenerationShields[self] ?? 0).toBe(0);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
  });
});
