// D397 - THE ANY-COLOUR TAIL THE PARSER CANNOT NAME REFUSES, and the three it can name resolve
// against the board. "Add one mana of any color among legendary creatures and planeswalkers you
// control" (Mox Amber) fell through to scope 'all' since D116 - five colours off an empty board -
// because the refusal was keyed on the words "could produce" rather than on the tail being
// non-empty. Found the day the spend-restriction seam made Plaza of Heroes OFFERABLE and its
// lines were read one by one. Every tail the parser cannot resolve is unread now (Paliano's
// draft-time choice), and the three "among legendary ..." wordings are scopes beside `landsYou`:
// derived colours for a permanent, printed ones for a graveyard card, and an EMPTY set when there
// is none - which is what the card says.

import { describe, expect, test } from 'vitest';
import { engineCompleteness } from '../data/engineComplete';
import { parseFace, parseManaProduction, parseTypeLine } from '../data/oracleParse';
import type { CardFace } from '../data/cardTypes';
import { KESS_DISSIDENT_MAGE, MOX_AMBER, PLAZA_OF_HEROES, THE_GREY_HAVENS } from '../data/fixtures/engineCards';
import { replay, stateHash } from './log';
import { manaSourcesOf } from './mana';
import { advanceUntil, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

const KESS_COLORS = [...KESS_DISSIDENT_MAGE.faces[0]!.colors].sort();

function anyColorLine(oracleText: string, name = 'Test Land') {
  const face = { name, oracleText } as unknown as CardFace;
  const warnings: string[] = [];
  const prods = parseManaProduction(face, parseTypeLine('Land'), (w) => warnings.push(w));
  return { prods, warnings };
}

describe('D397 - the any-colour scopes, parsed', () => {
  test('the three legendary wordings are scopes, unconditional', () => {
    const amber = parseFace(MOX_AMBER, 0).producesMana.find((p) => p.line !== null);
    expect(amber?.anyColor).toEqual({ scope: 'legendaryCreaturesWalkersYou', amount: 1 });
    expect(amber?.conditional).toBe(false);
    const havens = parseFace(THE_GREY_HAVENS, 0).producesMana.find((p) => p.anyColor);
    expect(havens?.anyColor).toEqual({ scope: 'legendaryGraveyard', amount: 1 });
    expect(havens?.conditional).toBe(false);
    const plaza = parseFace(PLAZA_OF_HEROES, 0).producesMana.filter((p) => p.anyColor);
    expect(plaza.map((p) => p.anyColor?.scope).sort()).toEqual(['all', 'legendaryYou']);
    // The restricted any-colour line beside them reads its restriction (the seam).
    expect(plaza.find((p) => p.anyColor?.scope === 'all')?.restriction?.spells).toEqual([[{ kind: 'supertype', value: 'Legendary' }]]);
  });

  test('a tail the parser cannot name produces NOTHING, and says so', () => {
    const gate = anyColorLine('{T}: Add one mana of any type that a Gate you control could produce.');
    expect(gate.prods).toEqual([]);
    expect(gate.warnings).toContain('mana:anyScopeUnread');
    const paliano = anyColorLine('{T}: Add one mana of any color chosen as you drafted cards named Paliano, the High City.');
    expect(paliano.prods).toEqual([]);
    expect(paliano.warnings).toContain('mana:anyScopeUnread');
    // The plain line and the two board scopes read as they always did.
    expect(anyColorLine('{T}: Add one mana of any color.').prods[0]?.anyColor).toEqual({ scope: 'all', amount: 1 });
    expect(anyColorLine('{T}: Add one mana of any type that a land you control could produce.').prods[0]?.anyColor?.scope).toBe('landsYou');
  });

  test('the accounting: the three cards run, Plaza of Heroes still owes its exile-self line', () => {
    expect(engineCompleteness(MOX_AMBER).complete).toBe(true);
    expect(engineCompleteness(THE_GREY_HAVENS).complete).toBe(true);
    const plaza = engineCompleteness(PLAZA_OF_HEROES);
    expect(plaza.complete).toBe(false);
    expect(plaza.leftover).toEqual(['{3}, {T}, Exile this land: Target legendary creature gains hexproof and indestructible until end of turn.']);
  });
});

describe('D397 - the any-colour scopes in play', () => {
  test('Mox Amber offers nothing with no legend and the legend\'s colours with one; the Havens read the graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Mox Amber', 'The Grey Havens', 'Kess, Dissident Mage', 'Grizzly Bears'], ['Grizzly Bears']] });
    const amber = put(g, 'p1', 'Mox Amber');
    const havens = put(g, 'p1', 'The Grey Havens');
    settle(g);
    const sources = () => manaSourcesOf(g.state, g.deps.oracle, g.deps.scripts, 'p1', { includeConditional: true, includeCostly: true, includeTapped: true });
    const colorsOf = (card: string) => {
      const s = sources().filter((x) => x.card === card && x.outputs.length > 0);
      return [...new Set(s.flatMap((x) => x.outputs.flatMap((o) => (['W', 'U', 'B', 'R', 'G'] as const).filter((c) => o.mana[c] > 0))))].sort();
    };
    // No legend anywhere: the Mox makes nothing, the Havens make only their colourless.
    expect(colorsOf(amber)).toEqual([]);
    expect(colorsOf(havens)).toEqual([]);
    expect(sources().some((x) => x.card === havens && x.outputs.some((o) => o.mana.C > 0))).toBe(true);
    // A legendary creature on the battlefield: the Mox makes its colours; the Havens still nothing (a permanent is not a card in a graveyard).
    const kess = put(g, 'p1', 'Kess, Dissident Mage');
    expect(colorsOf(amber)).toEqual(KESS_COLORS);
    expect(colorsOf(havens)).toEqual([]);
    // The legend in the graveyard: the Havens make its colours; the Mox is back to nothing.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'graveyard', player: 'p1' } }));
    expect(colorsOf(havens)).toEqual(KESS_COLORS);
    expect(colorsOf(amber)).toEqual([]);
    // A vanilla creature is neither a legend nor a legendary card: nothing moves.
    put(g, 'p1', 'Grizzly Bears');
    expect(colorsOf(amber)).toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
