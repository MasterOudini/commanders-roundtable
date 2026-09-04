// D312 - THE COST-REDUCTION SEAM, in the data layer: the four reduction shapes
// parse to what the engine prices, everything else refuses; a pure carrier is
// COMPLETE by the accounting alone; the disclosure says nothing; a reduction
// line is no clause of a spell; the classifier files it scriptable.

import { describe, expect, test } from 'vitest';
import { parseCostReductionLine, parseCostReductions } from './costParse';
import { engineCompleteness } from './engineComplete';
import { parseEffects } from './effectParse';
import { costReductionLineRuns, primitiveFor } from './primitives';
import { tier3NotesFor } from './tier3';
import { FROGMITE, MYR_ENFORCER, TOLARIAN_TERROR, WIZARD_S_RETORT } from './fixtures/engineCards';

describe('the cost-reduction seam (D312)', () => {
  test('the four shapes parse; a colour, a memory, a target refuse', () => {
    const aff = parseCostReductionLine('Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.)');
    expect(aff?.kind).toBe('affinity');
    expect(aff?.kind === 'affinity' ? aff.per[0]?.types : []).toEqual(['Artifact']);
    expect(aff?.line).toBe('Affinity for artifacts');
    const each = parseCostReductionLine('This spell costs {1} less to cast for each green creature you control.');
    expect(each?.kind).toBe('perControl');
    expect(each?.kind === 'perControl' ? [each.amount, each.per[0]?.colors, each.per[0]?.types] : []).toEqual([1, ['G'], ['Creature']]);
    const grave = parseCostReductionLine('This spell costs {1} less to cast for each instant and sorcery card in your graveyard.');
    expect(grave?.kind).toBe('perGraveyard');
    expect(grave?.kind === 'perGraveyard' ? grave.types : []).toEqual(['Instant', 'Sorcery']);
    const control = parseCostReductionLine('This spell costs {1} less to cast if you control a Wizard.');
    expect(control?.kind).toBe('ifControl');
    expect(control?.kind === 'ifControl' ? [control.amount, control.any[0]?.subtypes] : []).toEqual([1, ['Wizard']]);
    expect(parseCostReductionLine('This spell costs {G} less to cast for each green creature you control.')).toBeNull();
    expect(parseCostReductionLine('This spell costs {1} less to cast if a creature died this turn.')).toBeNull();
    expect(parseCostReductionLine('This spell costs {1} less to cast if it targets a tapped creature.')).toBeNull();
    expect(parseCostReductionLine("This spell costs {1} less to cast if it's bargained.")).toBeNull();
    expect(parseCostReductionLine('Affinity for tokens')).toBeNull();
    expect(parseCostReductions('Flying\nAffinity for Equipment\nTrample').map((r) => r.kind)).toEqual(['affinity']);
  });

  test('a pure carrier is complete by the accounting alone', () => {
    for (const card of [FROGMITE, MYR_ENFORCER, TOLARIAN_TERROR, WIZARD_S_RETORT]) {
      expect(engineCompleteness(card).complete, card.name).toBe(true);
    }
  });

  test('the disclosure says nothing about a reduction the engine prices', () => {
    expect(tier3NotesFor(FROGMITE)).toEqual([]);
    expect(tier3NotesFor(TOLARIAN_TERROR)).toEqual([]);
    expect(tier3NotesFor(WIZARD_S_RETORT)).toEqual([]);
  });

  test("a reduction line is no clause of a spell: Wizard's Retort is the counter alone, auto", () => {
    const parsed = parseEffects(WIZARD_S_RETORT.faces[0]?.oracleText ?? '', WIZARD_S_RETORT.name, true);
    expect(parsed.mode).toBe('auto');
    expect(parsed.effects.map((e) => e.kind)).toEqual(['counter']);
  });

  test('the classifier files a priced reduction scriptable and the rest as it was', () => {
    expect(costReductionLineRuns('Affinity for artifacts')).toBe(true);
    expect(costReductionLineRuns('This spell costs {2} less to cast if you control a Zombie.')).toBe(true);
    expect(costReductionLineRuns('This spell costs {1} less to cast if a creature died this turn.')).toBe(false);
    expect(primitiveFor({ text: 'Affinity for artifacts', kind: 'sentence' }, 'X')).toBe('scriptable');
    expect(primitiveFor({ text: 'This spell costs {1} less to cast for each artifact you control.', kind: 'sentence' }, 'X')).toBe('scriptable');
    expect(primitiveFor({ text: 'Affinity for tokens', kind: 'sentence' }, 'X')).toBe('keyword:altCost');
  });
});
