// D306 - THE CYCLING SEAM, the parser, accounting and classifier half: "Cycling
// {N}" is a synthesized activated ability (instant-speed, no target, a mana
// cost), the accounting and the disclosure no longer hold the line against the
// card, the classifier files it as scriptable; landcycling stays where it was.

import { describe, expect, test } from 'vitest';
import { LONELY_SANDBAR, SPARK_SPRAY, UNEARTH } from './fixtures/engineCards';
import { parseActivatedAbilities } from './activatedParse';
import { engineCompleteness } from './engineComplete';
import { parseManaCost } from './oracleParse';
import { cyclingLineRuns, primitiveFor } from './primitives';
import { tier3NotesFor } from './tier3';

const parse = (text: string, isPermanent = true) =>
  parseActivatedAbilities({ oracleText: text, isPermanent, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

describe('the Cycling seam (D306)', () => {
  test('Cycling {N} is a synthesized activated ability: no target, no timing restriction, a mana cost', () => {
    const abilities = parse('This land enters tapped.\n{T}: Add {U}.\nCycling {U} ({U}, Discard this card: Draw a card.)');
    const cycling = abilities.find((a) => a.cycling !== undefined);
    expect(cycling?.cycling?.line).toBe('Cycling {U}');
    expect(cycling?.costText).toBe('{U}');
    expect(cycling?.effectText).toBe('Draw a card.');
    expect(cycling?.sorceryOnly).toBe(false);
    expect(cycling?.payable).toBe(true);
    expect(cycling?.targets).toHaveLength(0);
  });

  test('on a spell the cycling ability is index 0; on Lonely Sandbar it follows the mana ability', () => {
    expect(parse('Spark Spray deals 1 damage to any target.\nCycling {1}', false)[0]?.cycling?.line).toBe('Cycling {1}');
    const sandbar = parse('This land enters tapped.\n{T}: Add {U}.\nCycling {U}');
    expect(sandbar.findIndex((a) => a.cycling !== undefined)).toBe(1);
  });

  test('a landcycling and a non-mana cycling cost are not synthesized', () => {
    expect(parse('Basic landcycling {2}').some((a) => a.cycling !== undefined)).toBe(false);
    expect(parse('Forestcycling {1}').some((a) => a.cycling !== undefined)).toBe(false);
    expect(parse('Cycling—Discard a land card.').some((a) => a.cycling !== undefined)).toBe(false);
  });

  test('the accounting and the disclosure no longer hold the Cycling line against the card', () => {
    expect(engineCompleteness(UNEARTH).leftover).not.toContain('Cycling {2}');
    expect(engineCompleteness(LONELY_SANDBAR).complete).toBe(true);
    expect(engineCompleteness(SPARK_SPRAY).complete).toBe(true);
    expect(tier3NotesFor(LONELY_SANDBAR).map((n) => n.what)).toEqual([]);
    expect(tier3NotesFor(UNEARTH).map((n) => n.what)).not.toContain('Cycling');
  });

  test('the classifier files a mana Cycling as scriptable and a landcycling as keyword:altCost', () => {
    expect(cyclingLineRuns('Cycling {2}')).toBe(true);
    expect(cyclingLineRuns('Cycling {1}{W}')).toBe(true);
    expect(cyclingLineRuns('Basic landcycling {2}')).toBe(false);
    expect(primitiveFor({ text: 'Cycling {2}', kind: 'sentence' }, 'X')).toBe('scriptable');
    expect(primitiveFor({ text: 'Basic landcycling {2}', kind: 'sentence' }, 'X')).toBe('keyword:other');
  });
});
