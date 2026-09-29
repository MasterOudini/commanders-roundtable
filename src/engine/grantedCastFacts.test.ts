// Copy to src/engine/. D587 - THE GRANTED CAST'S HOST FACTS (FIX-LIST 11 - the review's freecast FC-3 and FC-4; and the
// preview half of FIX-LIST 10). A cast granted by a resolving effect is never offered, so no `CastSpell` action carries what
// a client needs to preview it: the host ships it PER SEAT beside `legal` (`SessionState.granted`, built by
// `grantedCastFacts`) - never on the shared prompt, where a from-hand grant's hidden cards would be named to every seat.
// What is proven here, on Sram's Expertise (`You may cast a spell with mana value 3 or less from your hand without paying
// its mana cost.`) under Helm of Awakening: the facts list exactly the cards the grant admits - the answer's own reader,
// so not Baloth Gorger (mana value 4) and not a land - each with the board's reduction for its cast; Light 'Em Up's
// casualty creatures are the host's DERIVED list: a face-down Hill Giant is a 2/2 creature (CR 708.2) and pays casualty
// 2, a 1/1 Servo does not; the other seat is shipped nothing; the replay hash.
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { grantedCastFacts, legalContext } from './legal';
import { replay, stateHash } from './log';
import type { Game } from './game';

const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const factsFor = (g: Game, player: 'p1' | 'p2') => grantedCastFacts(g.state, g.deps.oracle, g.deps.scripts, player, legalContext(g.state, g.deps.oracle, g.deps.scripts, player));

describe("D587 - the granted cast's host facts, shipped per seat", () => {
  test("Sram's Expertise under Helm of Awakening: the admitted cards with their reduction, and the casualty's derived creatures - a face-down 2/2 among them", () => {
    const g = startedGame({ players: 2, decks: [["Sram's Expertise", "Light 'Em Up", 'Kavu Titan', 'Baloth Gorger', 'Hill Giant', 'Helm of Awakening'], ['Grizzly Bears']], options: { maxHandSize: null } });
    holdEverywhere(g);
    const sram = put(g, 'p1', "Sram's Expertise", 'hand');
    const light = put(g, 'p1', "Light 'Em Up", 'hand');
    const titan = put(g, 'p1', 'Kavu Titan', 'hand');
    const gorger = put(g, 'p1', 'Baloth Gorger', 'hand');
    const giant = put(g, 'p1', 'Hill Giant', 'hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: giant, to: { kind: 'battlefield', player: 'p1' }, faceDown: true }));
    put(g, 'p1', 'Helm of Awakening');
    main(g, 3);
    // The Helm cuts the Expertise to {1}{W}{W}.
    mana(g, 'WWC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: sram, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.castFree === true, 20_000);
    expect(g.state.cards[giant]?.faceDown, 'the Giant is face down').toBe(true);
    const facts = factsFor(g, 'p1');
    expect(Object.keys(facts ?? {}).sort(), 'the cards the grant admits: not the mana value 4 Gorger, not a land').toEqual([light, titan].sort());
    expect(facts?.[gorger]).toBeUndefined();
    expect(facts?.[light], "the Helm's {1}, and the casualty's creatures off the DERIVED board: the face-down 2/2, never a 1/1 Servo").toEqual({ reduction: 1, casualtyCandidates: [giant] });
    expect(facts?.[titan], 'the Helm reduces every spell; the Titan prints no conspire or casualty').toEqual({ reduction: 1 });
    expect(factsFor(g, 'p2'), 'the other seat is shipped nothing').toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
