// The noun lists the format prints that the target parser did not read
// (D293): each parses to the UNION of its kinds with nothing unenforced, and
// the effect parser admits the sentence only because of that.

import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from '../data/targetParse';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { createRegistry } from './scripts/registry';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const FRACTURE = 'Aura Fracture'; // an enchantment spell, {2}{W}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p2 mid-cast of `name` (held on the stack); p1 to respond with `spell` in hand and mana up. */
function held(spellName: string, name: string, mana: { symbol: 'G' | 'W'; colorless: number }): { g: Game; theirs: InstanceId; stackId: string; spell: InstanceId } {
  const g = startedGame({ players: 2, decks: [[spellName], [name]], scripts: createRegistry([]) });
  holdEverywhere(g);
  const theirs = put(g, 'p2', name, 'hand');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 2 && s.turn.activePlayer === 'p2' && s.priority.player === 'p2' && s.priority.awaiting === null && (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: mana.symbol, amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: mana.colorless }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: theirs }));
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const stackId = g.state.stack[0]?.id as string;
  const spell = put(g, 'p1', spellName, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, theirs, stackId, spell };
}

describe('the lists run live, with no script (D293)', () => {
  test('Mystic Denial counters a held creature spell', () => {
    const { g, theirs, stackId } = held('Mystic Denial', BEARS, { symbol: 'G', colorless: 1 });
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('Mystic Denial refuses a held enchantment spell (the typed list)', () => {
    const { g, stackId } = held('Mystic Denial', FRACTURE, { symbol: 'W', colorless: 2 });
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }).ok).toBe(false);
  });

  test('"spell or creature" is read by the target parser but WITHHELD from the effect parser', () => {
    // The live proof for Unsubstantiate aimed at a held creature spell let the
    // spell resolve: the auto bounce has no path for a stack object. Until a
    // bounce can lift a spell off the stack, the sentence is not admitted, so
    // no half-executing card ships (D90).
    expect(parseTargetClauses("Return target spell or creature to its owner's hand.")[0]?.kinds).toEqual(['spell', 'creature']);
    expect(parseEffects("Return target spell or creature to its owner's hand.", 'Unsubstantiate', true).mode).not.toBe('auto');
  });
});

describe('noun lists are READ (D293)', () => {
  test('"artifact, enchantment, or creature" is the union of three kinds', () => {
    const [spec] = parseTargetClauses('Destroy target artifact, enchantment, or creature.');
    expect(spec?.kinds).toEqual(['artifact', 'enchantment', 'creature']);
    expect(spec?.unenforced).toEqual([]);
    expect(spec?.text).toBe('target artifact, enchantment, or creature');
  });

  test('"creature, planeswalker, or battle" and "creature, planeswalker, or player"', () => {
    expect(parseTargetClauses('Destroy target creature, planeswalker, or battle.')[0]?.kinds).toEqual(['creature', 'planeswalker', 'battle']);
    expect(parseTargetClauses('It deals 3 damage to target creature, planeswalker, or player.')[0]?.kinds).toEqual(['creature', 'planeswalker', 'player']);
  });

  test('"creature, enchantment, or planeswalker" and "spell or creature"', () => {
    expect(parseTargetClauses('Exile target creature, enchantment, or planeswalker.')[0]?.kinds).toEqual(['creature', 'enchantment', 'planeswalker']);
    expect(parseTargetClauses('Return target spell or creature to its owner\'s hand.')[0]?.kinds).toEqual(['spell', 'creature']);
  });

  test('"creature or sorcery spell" is a typed spell clause', () => {
    const [spec] = parseTargetClauses('Counter target creature or sorcery spell.');
    expect(spec?.kinds).toEqual(['spell']);
    expect(spec?.cardTypes).toEqual(['Creature', 'Sorcery']);
  });

  test('a list with a SUBTYPE alternative is not widened: "creature or Vehicle" still reads only the creature', () => {
    // The spec has no subtype field, so the Vehicle alternative waits on a
    // subtype seam; until then the clause narrows to the creature noun and the
    // effect parser refuses the sentence, so no card ships over it.
    const [spec] = parseTargetClauses('Destroy target creature or Vehicle.');
    expect(spec?.kinds).toEqual(['creature']);
    expect(parseEffects('Destroy target creature or Vehicle.', 'x', true).mode).not.toBe('auto');
  });

  test('a qualifier after a list binds one alternative in print, so the clause stays free aim (mana value excepted)', () => {
    const [flying] = parseTargetClauses('Destroy target artifact, enchantment, or creature with flying.');
    expect(flying?.kinds).toEqual([]);
    const [power] = parseTargetClauses('Destroy target artifact, enchantment, or creature with power 4 or greater.');
    expect(power?.kinds).toEqual([]);
    const [mv] = parseTargetClauses('Destroy target artifact or enchantment with mana value 3 or less.');
    expect(mv?.kinds).toEqual(['artifact', 'enchantment']);
    expect(mv?.numeric).toEqual({ attr: 'manaValue', cmp: 'atMost', value: 3 });
  });

  test('the effect parser admits the sentences now that the lists are enforced', () => {
    expect(parseEffects('Destroy target artifact, enchantment, or creature.', 'x', true).mode).toBe('auto');
    expect(parseEffects('Destroy target creature, planeswalker, or battle.', 'x', true).mode).toBe('auto');
    expect(parseEffects('Counter target creature or sorcery spell.', 'x', true).mode).toBe('auto');
  });
});
