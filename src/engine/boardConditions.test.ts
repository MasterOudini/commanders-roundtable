// D621 - TWO BOARD QUERIES in the one grammar every gate, activation and enters-tapped clause asks (D342's `conditionOf`):
// `you control a creature with power N or greater` (FEROCIOUS - read off DERIVED power) and `an opponent controls more
// lands than you`. What is proven: the reads, through the activation reader too; the answers over a real board - a 2/2
// is not enough and a 6/6 is; one opponent with more lands is, a tie is not.

import { describe, expect, test } from 'vitest';
import { conditionOf } from '../data/replacementParse';
import { parseActivationConditions } from '../data/activatedParse';
import { conditionHolds } from './triggers';
import { createRegistry } from './scripts/registryCore';
import { holdEverywhere, put, startedGame } from './testing/harness';

const FEROCIOUS = 'you control a creature with power 4 or greater';
const CATCH_UP = 'an opponent controls more lands than you';
const FORESTS: string[] = Array.from({ length: 6 }, () => 'Forest');

describe('D621 - the ferocious and the catch-up board queries', () => {
  test('the reads, and the activation reader asks the same grammar', () => {
    expect(conditionOf(FEROCIOUS)).toEqual({ kind: 'creaturePower', power: 4 });
    expect(conditionOf(CATCH_UP)).toEqual({ kind: 'opponentMoreLands' });
    expect(parseActivationConditions('Activate only if ' + FEROCIOUS + '.').conditions).toEqual([{ kind: 'board', condition: { kind: 'creaturePower', power: 4 } }]);
  });

  test('a 2/2 is not ferocious and a 6/6 is', () => {
    const g = startedGame({ decks: [['Grizzly Bears', 'Colossal Dreadmaw', ...FORESTS], [...FORESTS]], scripts: createRegistry([]) });
    holdEverywhere(g);
    const q = { kind: 'creaturePower' as const, power: 4 };
    put(g, 'p1', 'Grizzly Bears');
    expect(conditionHolds(g.state, g.deps.oracle, g.deps.scripts, q, 'p1')).toBe(false);
    put(g, 'p1', 'Colossal Dreadmaw');
    expect(conditionHolds(g.state, g.deps.oracle, g.deps.scripts, q, 'p1')).toBe(true);
    expect(conditionHolds(g.state, g.deps.oracle, g.deps.scripts, q, 'p2'), 'the opponent controls neither').toBe(false);
  });

  test('an opponent with more lands catches up; a tie does not', () => {
    const g = startedGame({ decks: [[...FORESTS], [...FORESTS]], scripts: createRegistry([]) });
    holdEverywhere(g);
    const q = { kind: 'opponentMoreLands' as const };
    put(g, 'p1', 'Forest');
    put(g, 'p2', 'Forest');
    expect(conditionHolds(g.state, g.deps.oracle, g.deps.scripts, q, 'p1'), 'one each').toBe(false);
    put(g, 'p2', 'Forest');
    expect(conditionHolds(g.state, g.deps.oracle, g.deps.scripts, q, 'p1')).toBe(true);
    expect(conditionHolds(g.state, g.deps.oracle, g.deps.scripts, q, 'p2'), 'the one ahead').toBe(false);
  });
});
