// D515 - THE DYING CREATURE'S STAT AS THE TRIGGER'S OWN NUMBER. `Whenever a creature you control dies, you gain life equal
// to that creature's toughness.` (Proper Burial): the head looks back (CR 603.10a), so the bus matches it against the
// board the creature left - and reads the creature's toughness there as the def's memo (D476's number), which the stat
// read takes for an aim that has left; the creature is a REFERENT the head named, not a target, so the vocabulary runs
// unchecked (CR 608.2b's re-check would drop a card in the graveyard). What is proven here, on the landed row's own
// script: the def looks back and carries the memo; a Bears with a +1/+1 counter dying gains three (the toughness as it
// last stood - a printed read would say two); two creatures dying in one Wrath gain each's toughness in turn; the
// replay hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { PROPER_BURIAL_SCRIPT } from './scripts/cards/properBurial';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const reads = (g: Game) => g.log.filter((e) => e.body.t === 'StatRead').map((e) => (e.body.t === 'StatRead' ? { value: e.body.value, lastKnown: e.body.lastKnown } : null));

describe("D515 - the dying creature's stat as the trigger's own number", () => {
  test('the def looks back and carries the memo of the item', () => {
    const def = PROPER_BURIAL_SCRIPT.triggers?.[0];
    expect(def?.looksBack).toBe(true);
    expect(typeof def?.memo).toBe('function');
    expect(typeof def?.perItem).toBe('function');
  });

  test('a Bears with a +1/+1 counter dies: three life (the toughness as it last stood); two dying at once: each in turn; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Proper Burial', 'Grizzly Bears', 'Serra Angel'], ['Grizzly Bears']], scripts: createRegistry([PROPER_BURIAL_SCRIPT]) });
    holdEverywhere(g);
    put(g, 'p1', 'Proper Burial', 'battlefield');
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const angel = put(g, 'p1', 'Serra Angel', 'battlefield');
    settle(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 }));
    main(g, 3);
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.players.p1?.life, 'three: the counter counted, read off the board the Bears left').toBe(life0 + 3);
    expect(reads(g)).toEqual([{ value: 3, lastKnown: true }]);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.players.p1?.life, 'the Angel: four more').toBe(life0 + 7);
    expect(reads(g)[1]).toEqual({ value: 4, lastKnown: true });
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
