// `Multani's Decree` — both enchantments die, 2 apiece; the creature
// stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MULTANIS_DECREE_SCRIPT } from './multanisDecree';
import { MULTANI_S_DECREE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function decreed(): { g: Game; mine: InstanceId; theirs: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Multani's Decree", 'Captive Flame', 'Grizzly Bears'], ['Captive Flame']],
    scripts: createRegistry([MULTANIS_DECREE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Captive Flame');
  const theirs = put(g, 'p2', 'Captive Flame');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Multani's Decree", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, bears };
}

describe("Multani's Decree", () => {
  test('both enchantments die and pay 2 apiece; the Bears stands', () => {
    const { g, mine, theirs, bears } = decreed();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MULTANI_S_DECREE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MULTANI_S_DECREE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MULTANI_S_DECREE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = decreed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
