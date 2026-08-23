// `Tivadar's Crusade` — the subtype wipe, proven from both sides: every
// Goblin on the table dies whoever controls it, and nothing else does.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TIVADARS_CRUSADE_SCRIPT } from './tivadarsCrusade';
import { TIVADAR_S_CRUSADE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Tivadar's Crusade";
const GOBLIN = 'Mogg Raider'; // Creature — Goblin
const KRENKO = 'Krenko, Mob Boss'; // Legendary Creature — Goblin Warrior
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function crusaded(): {
  g: Game;
  mine: InstanceId;
  theirs: InstanceId;
  bystander: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, GOBLIN, BEARS], [KRENKO]],
    scripts: createRegistry([TIVADARS_CRUSADE_SCRIPT]),
  });
  const mine = put(g, 'p1', GOBLIN);
  const bystander = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', KRENKO);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, bystander };
}

describe("Tivadar's Crusade", () => {
  test('every Goblin dies — mine included — and the Bears stand', () => {
    const { g, mine, theirs, bystander } = crusaded();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bystander]?.zone.kind).toBe('battlefield');
  });

  test('the subtype is read DERIVED — Krenko is a Goblin Warrior, not a bare Goblin', () => {
    const { g, theirs } = crusaded();
    // The filter asks the subtype LIST, so a Goblin with a second creature
    // type is still a Goblin.
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TIVADAR_S_CRUSADE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TIVADAR_S_CRUSADE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TIVADAR_S_CRUSADE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = crusaded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
