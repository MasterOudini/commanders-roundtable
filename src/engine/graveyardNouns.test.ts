// D298 - the graveyard-return slot: "Return target <adjectives> <type> card from
// your graveyard to your hand / the battlefield". The target parser enforces
// the adjective (D294) and the typed noun (like "creature card" since D138); the
// effect parser admits exactly those. Proven three ways: the parse, the effect
// parser's admission, and real cards cast from the ORACLE with no script.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { parseTargetClauses } from '../data/targetParse';
import { createRegistry } from './scripts/registry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

describe('typed and adjectived graveyard nouns parse enforced (D298)', () => {
  test('"green card from your graveyard" is a graveyard card restricted by colour', () => {
    const spec = parseTargetClauses('Return target green card from your graveyard to your hand.')[0];
    expect(spec?.kinds).toEqual(['card']);
    expect(spec?.zones).toEqual(['graveyard']);
    expect(spec?.restrict).toEqual({ colorsAny: ['G'] });
    expect(spec?.unenforced).toEqual([]);
  });

  test('"sorcery card" / "artifact card" carry the type; "noncreature, nonland card" both negations', () => {
    expect(parseTargetClauses('Return target sorcery card from your graveyard to your hand.')[0]?.cardTypes).toEqual(['Sorcery']);
    expect(parseTargetClauses('Return target artifact card from your graveyard to the battlefield.')[0]?.cardTypes).toEqual(['Artifact']);
    const two = parseTargetClauses('Return target noncreature, nonland card from your graveyard to your hand.')[0];
    expect(two?.kinds).toEqual(['card']);
    expect(two?.restrict).toEqual({ typesNone: ['Creature', 'Land'] });
    expect(two?.unenforced).toEqual([]);
  });

  test('a subtype card noun and a card list are read and enforced', () => {
    const zombie = parseTargetClauses('Return target Zombie card from your graveyard to your hand.')[0];
    expect(zombie?.kinds).toEqual(['card']);
    expect(zombie?.restrict).toEqual({ subtypesAll: ['Zombie'] });
    expect(zombie?.unenforced).toEqual([]);
    const list = parseTargetClauses('Return target artifact or enchantment card from your graveyard to your hand.')[0];
    expect(list?.kinds).toEqual(['card']);
    expect(list?.alternatives?.map((a) => a.cardTypes)).toEqual([['Artifact'], ['Enchantment']]);
    expect(list?.zones).toEqual(['graveyard']);
  });

  test('the effect parser admits the enforced shapes and refuses an unenforced word', () => {
    expect(parseEffects('Return target green card from your graveyard to your hand.', 'Revive', true).mode).toBe('auto');
    expect(parseEffects('Return target sorcery card from your graveyard to your hand.', 'X', true).mode).toBe('auto');
    expect(parseEffects('Return target noncreature, nonland card from your graveyard to your hand.', 'X', true).mode).toBe('auto');
    expect(parseEffects('Return target Zombie card from your graveyard to your hand.', 'X', true).mode).toBe('auto');
    expect(parseEffects('Return target artifact or enchantment card from your graveyard to your hand.', 'X', true).mode).toBe('auto');
    // "permanent card" has been enforced since D147 (six types); the effect parser's old note was stale.
    expect(parseEffects('Return target permanent card from your graveyard to your hand.', 'X', true).mode).toBe('auto');
    expect(parseEffects('Return target historic card from your graveyard to your hand.', 'X', true).mode).not.toBe('auto');
    expect(parseEffects('Return target Elf card from your graveyard to your hand.', 'X', true).mode).not.toBe('auto');
  });

  test('a comma between two adjectives is read by both parsers (Terror, Power Word Kill)', () => {
    const terror = parseTargetClauses("Destroy target nonartifact, nonblack creature. It can't be regenerated.")[0];
    expect(terror?.restrict).toEqual({ colorsNone: ['B'], typesNone: ['Artifact'] });
    expect(terror?.unenforced).toEqual([]);
    expect(parseEffects("Destroy target nonartifact, nonblack creature. It can't be regenerated.", 'Terror', true).mode).toBe('auto');
    const pwk = parseTargetClauses('Destroy target non-Angel, non-Demon, non-Devil, non-Dragon creature.')[0];
    expect(pwk?.restrict).toEqual({ subtypesNone: ['Angel', 'Demon', 'Devil', 'Dragon'] });
    expect(parseEffects('Destroy target non-Angel, non-Demon, non-Devil, non-Dragon creature.', 'Power Word Kill', true).mode).toBe('auto');
  });
});

const BEARS = 'Grizzly Bears'; // green
const HAWK = 'Vampire Nighthawk'; // black
const CALERIA = 'Lady Caleria'; // green-white, multicoloured

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(spell: string, mana: readonly (readonly ['W' | 'U' | 'B' | 'R' | 'G' | 'C', number])[]): { g: Game; bears: InstanceId; hawk: InstanceId; caleria: InstanceId } {
  const g = startedGame({ players: 2, decks: [[spell, BEARS, HAWK, CALERIA], [BEARS]], scripts: createRegistry([]) });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p1', BEARS, 'graveyard');
  const hawk = put(g, 'p1', HAWK, 'graveyard');
  const caleria = put(g, 'p1', CALERIA, 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const card = put(g, 'p1', spell, 'hand');
  for (const [sym, n] of mana) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears, hawk, caleria };
}

describe('the cards run from the oracle alone (D298)', () => {
  test('Revive refuses the black Nighthawk in the graveyard and returns the green Bears', () => {
    const { g, bears, hawk } = armed('Revive', [['G', 1], ['C', 1]]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
  });

  test('Reborn Hope refuses the monocoloured Bears and returns the multicoloured Caleria', () => {
    const { g, bears, caleria } = armed('Reborn Hope', [['G', 1], ['W', 1]]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: caleria }] }));
    settle(g);
    expect(g.state.cards[caleria]?.zone.kind).toBe('hand');
  });
});
