// D434 - THE MILL VOCABULARY: `Mill three cards.` (the caster's own library), `Target player mills two cards.` (the
// aimed player's) and `Each player mills a card.` (every member of a player scope, APNAP) - the top N of a library into
// its graveyard, top card first (CR 701.13). A short library mills what it has: no loss, no prompt.

import { describe, expect, test } from 'vitest';
import { checkInvariants } from './invariants';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
/** A draw-step head whose payload is aimed at the active player (the generated eachPlayerDrawStep shape). */
function head(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'eachPlayerDrawStep-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'draw',
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: targets.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, effects, targets);
      },
    }],
  };
}
const AIMED = head('Grizzly Bears', 'Target player mills two cards.');
const OWN = head('Coral Eel', 'Mill three cards.');
const ALL = head('Grizzly Bears', 'Each player mills a card.');
const FIVE = head('Coral Eel', 'Target player mills five cards.');
const NOTE = head('Grizzly Bears', 'Mill two cards. Draw a card.');
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];

function armed(script: CardScript, name: string, p2Deck: readonly string[] = [...TEN, ...TEN], librarySize = 30): Game {
  const g = startedGame({ players: 2, decks: [[name, ...TEN, ...TEN], [...p2Deck]], librarySize, scripts: createRegistry([script]) });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', name);
  settle(g);
  return g;
}
const gy = (g: Game, p: string): number => g.state.zones.graveyard[p]?.length ?? 0;
const lib = (g: Game, p: string): readonly string[] => g.state.zones.library[p] ?? [];

describe('the mill vocabulary (D434)', () => {
  test('the vocabulary reads the own, the aimed and the scoped mill, past seven', () => {
    const own = parseEffects('Mill three cards.', 'Skaab', true);
    expect(own.mode).toBe('auto');
    expect(own.effects.map((e) => [e.kind, e.amount, e.self])).toEqual([['mill', 3, true]]);
    const aimed = parseEffects('Target player mills ten cards.', 'Glimpse', true);
    expect(aimed.mode).toBe('auto');
    expect(aimed.effects.map((e) => [e.kind, e.amount, e.targetIndex, e.self])).toEqual([['mill', 10, 0, false]]);
    const scoped = parseEffects('Each opponent mills four cards.', 'Wave', true);
    expect(scoped.mode).toBe('auto');
    expect(scoped.effects[0]?.scopes).toEqual([{ kind: 'player', controller: 'opponents' }]);
    // The continued subject reaches the mill too (the ask stays last).
    const both = parseEffects('Target player mills two cards, then discards a card.', 'Whisper', true);
    expect(both.mode).toBe('auto');
    expect(both.effects.map((e) => [e.kind, e.targetIndex, e.referent === true])).toEqual([['mill', 0, false], ['discard', 0, true]]);
  });

  test('the aimed mill takes the top two of the active player, top card first, and none of the controller', () => {
    const g = armed(AIMED, 'Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'draw', 20_000);
    const before = [...lib(g, 'p2')];
    const gy1 = gy(g, 'p1');
    const gy2 = gy(g, 'p2');
    settle(g);
    expect(gy(g, 'p2')).toBe(gy2 + 2);
    expect(gy(g, 'p1')).toBe(gy1);
    expect(lib(g, 'p2').length).toBe(before.length - 2);
    // The top of a library is the END of the array; the top card lands in the graveyard first.
    const milled = (g.state.zones.graveyard.p2 ?? []).slice(-2);
    expect(milled).toEqual([before[before.length - 1], before[before.length - 2]]);
  });

  test("the own mill is the controller's library, whoever's draw step fired it", () => {
    const g = armed(OWN, 'Coral Eel');
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'draw', 20_000);
    const gy1 = gy(g, 'p1');
    const gy2 = gy(g, 'p2');
    settle(g);
    expect(gy(g, 'p1')).toBe(gy1 + 3);
    expect(gy(g, 'p2')).toBe(gy2);
  });

  test('the scoped mill takes one from every player', () => {
    const g = armed(ALL, 'Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'draw', 20_000);
    const gy1 = gy(g, 'p1');
    const gy2 = gy(g, 'p2');
    settle(g);
    expect(gy(g, 'p1')).toBe(gy1 + 1);
    expect(gy(g, 'p2')).toBe(gy2 + 1);
  });

  test('a short library mills what it has and loses nothing', () => {
    // Ten-card libraries: seven in hand, three left, two after the turn-2 draw - a mill of five takes two.
    const g = armed(FIVE, 'Coral Eel', TEN, 10);
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'draw', 20_000);
    const gy2 = gy(g, 'p2');
    const left = lib(g, 'p2').length;
    expect(left).toBe(2);
    settle(g);
    expect(gy(g, 'p2')).toBe(gy2 + 2);
    expect(lib(g, 'p2').length).toBe(0);
    expect(g.state.players.p2).toBeDefined();
    expect(g.log.some((e) => e.body.t === 'DrewFromEmptyLibrary')).toBe(false);
  });

  test('a mill and a draw in one resolution read the library in turn (D437): the draw takes the card under the milled ones', () => {
    const g = armed(NOTE, 'Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'draw', 20_000);
    const before = [...lib(g, 'p1')];
    const gy1 = gy(g, 'p1');
    const hand1 = (g.state.zones.hand.p1 ?? []).length;
    settle(g);
    expect(gy(g, 'p1')).toBe(gy1 + 2);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand1 + 1);
    const third = before[before.length - 3];
    expect(g.state.cards[third as string]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(checkInvariants(g.state)).toEqual([]);
  });

  test('replays to the same hash', () => {
    const g = armed(AIMED, 'Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
