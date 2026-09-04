// D311 - THE CREW SEAM, in the data layer: "Crew N" is synthesized as an
// activated ability with a power-summed tap cost and no mana; a pure Vehicle
// is COMPLETE by the accounting alone; the disclosure says nothing; the
// classifier files the line scriptable.

import { describe, expect, test } from 'vitest';
import { CONSULATE_DREADNOUGHT, CULTIVATOR_S_CARAVAN, SKY_SKIFF } from './fixtures/engineCards';
import { engineCompleteness } from './engineComplete';
import { parseFace } from './oracleParse';
import { crewLineRuns, primitiveFor } from './primitives';
import { tier3NotesFor } from './tier3';

describe('the crew seam (D311)', () => {
  test('Crew N is an activated ability: a power-summed tap cost, no mana, the animation as its effect', () => {
    const face = parseFace(SKY_SKIFF, 0);
    const crew = face.activated.find((a) => a.crew !== undefined);
    expect(crew).toBeDefined();
    expect(crew?.crew?.power).toBe(1);
    expect(crew?.costText).toBe('Crew 1');
    expect(crew?.effectText).toBe('This Vehicle becomes an artifact creature until end of turn.');
    expect(crew?.tapCost?.powerAtLeast).toBe(1);
    expect(crew?.tapCost?.count).toBe(0);
    expect(crew?.payable).toBe(true);
    expect(crew?.sorceryOnly).toBe(false);
    expect(crew?.targets).toEqual([]);
    const six = parseFace(CONSULATE_DREADNOUGHT, 0).activated.find((a) => a.crew !== undefined);
    expect(six?.crew?.power).toBe(6);
  });

  test('a pure Vehicle is complete by the accounting alone', () => {
    for (const card of [SKY_SKIFF, CONSULATE_DREADNOUGHT, CULTIVATOR_S_CARAVAN]) {
      expect(engineCompleteness(card).complete, card.name).toBe(true);
    }
  });

  test('the disclosure says nothing about a crew the engine runs', () => {
    expect(tier3NotesFor(SKY_SKIFF)).toEqual([]);
    expect(tier3NotesFor(CULTIVATOR_S_CARAVAN)).toEqual([]);
  });

  test('the classifier files the line scriptable', () => {
    expect(crewLineRuns('Crew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artifact creature until end of turn.)')).toBe(true);
    expect(crewLineRuns('Crew 2')).toBe(true);
    expect(crewLineRuns('Crew')).toBe(false);
    expect(primitiveFor({ text: 'Crew 3', kind: 'sentence' }, 'X')).toBe('scriptable');
  });
});
