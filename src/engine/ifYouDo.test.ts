// D435 - THE IF-YOU-DO PAIR: `Draw a card. If you do, discard a card.` (the loot the library gates - an empty library
// draws nothing and discards nothing; the drawn card may be the one discarded) and `Discard a card. If you do, draw a
// card.` (the rummage the hand gates - an empty hand discards nothing and draws nothing; the draw follows the answer).
// Each is ONE clause of the vocabulary: a discard of the controller's own with the draw riding it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
/** An upkeep head whose payload is the controller's own (the generated yourUpkeep shape). */
function head(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'upkeep-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
const LOOT = head('Grizzly Bears', 'Draw a card. If you do, discard a card.');
const RUMMAGE = head('Coral Eel', 'Discard a card. If you do, draw a card.');
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];

function armed(script: CardScript, name: string, librarySize = 30): Game {
  const g = startedGame({ players: 2, decks: [[name, ...TEN, ...TEN], [...TEN, ...TEN]], librarySize, scripts: createRegistry([script]) });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', name);
  settle(g);
  return g;
}
const hand = (g: Game): readonly InstanceId[] => g.state.zones.hand.p1 ?? [];
const gy = (g: Game): number => g.state.zones.graveyard.p1?.length ?? 0;
const lib = (g: Game): number => g.state.zones.library.p1?.length ?? 0;
/** Strip p1's hand and library down to `keepHand` / `keepLib` cards, through the manual moves the harness allows. */
function strip(g: Game, keepHand: number, keepLib: number): void {
  for (const card of [...hand(g)].slice(keepHand)) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'exile', player: 'p1' } }));
  for (const card of [...(g.state.zones.library.p1 ?? [])].slice(keepLib)) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'exile', player: 'p1' } }));
}
function atUpkeep(g: Game, turn: number): void {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.step === 'upkeep' && s.turn.activePlayer === 'p1', 20_000);
}

describe('the if-you-do pair (D435)', () => {
  test('the vocabulary reads each as one clause, the draw riding the discard', () => {
    const loot = parseEffects('Draw a card. If you do, discard a card.', 'Looter', true);
    expect(loot.mode).toBe('auto');
    expect(loot.effects.map((e) => [e.kind, e.amount, e.self, e.ifDrew ?? 0, e.thenDraw])).toEqual([['discard', 1, true, 1, 0]]);
    const two = parseEffects('Draw two cards. If you do, discard a card.', 'Mask', true);
    expect(two.effects.map((e) => [e.kind, e.amount, e.ifDrew ?? 0])).toEqual([['discard', 1, 2]]);
    const rummage = parseEffects('Discard a card. If you do, draw two cards.', 'Rummager', true);
    expect(rummage.mode).toBe('auto');
    expect(rummage.effects.map((e) => [e.kind, e.amount, e.self, e.ifDrew ?? 0, e.thenDraw])).toEqual([['discard', 1, true, 0, 2]]);
  });

  test('the loot draws, then asks for the discard off the hand as drawn into', () => {
    const g = armed(LOOT, 'Grizzly Bears');
    atUpkeep(g, 3);
    const h0 = hand(g).length;
    const g0 = gy(g);
    const l0 = lib(g);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    expect(hand(g).length).toBe(h0 + 1);
    // The drawn card is in the hand the prompt reads: discarding it is legal.
    const drawn = hand(g)[hand(g).length - 1] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [drawn] }));
    settle(g);
    expect(hand(g).length).toBe(h0);
    expect(gy(g)).toBe(g0 + 1);
    expect(lib(g)).toBe(l0 - 1);
    expect(g.state.cards[drawn]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
  });

  test('an empty library draws nothing, so the loot discards nothing', () => {
    const g = armed(LOOT, 'Grizzly Bears');
    // The trigger is pending at the upkeep; the library is emptied under it, and the resolution finds nothing to draw.
    atUpkeep(g, 3);
    strip(g, 3, 0);
    const h0 = hand(g).length;
    const g0 = gy(g);
    settle(g);
    expect(hand(g).length).toBe(h0);
    expect(gy(g)).toBe(g0);
    expect(g.state.priority.awaiting).toBeNull();
    // The attempt was real (CR 704.5b - the loss flag is set); only the discard it gated is skipped.
    expect(g.log.some((e) => e.body.t === 'DrewFromEmptyLibrary')).toBe(true);
  });

  test('a hand of one after the draw goes whole, unasked', () => {
    const g = armed(LOOT, 'Grizzly Bears');
    atUpkeep(g, 3);
    strip(g, 0, 5);
    const g0 = gy(g);
    const asks0 = g.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone').length;
    settle(g);
    // The loot draws the one card and discards it whole - no prompt.
    expect(hand(g).length).toBe(0);
    expect(gy(g)).toBe(g0 + 1);
    expect(g.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone').length).toBe(asks0);
  });

  test('the rummage asks, and the draw follows the answer', () => {
    const g = armed(RUMMAGE, 'Coral Eel');
    atUpkeep(g, 3);
    const h0 = hand(g).length;
    const g0 = gy(g);
    const l0 = lib(g);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    expect(hand(g).length).toBe(h0);
    expect(lib(g)).toBe(l0);
    const pick = hand(g)[0] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [pick] }));
    settle(g);
    expect(gy(g)).toBe(g0 + 1);
    expect(lib(g)).toBe(l0 - 1);
    expect(hand(g).length).toBe(h0);
    expect(g.state.cards[pick]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
  });

  test('an empty hand discards nothing, so the rummage draws nothing', () => {
    const g = armed(RUMMAGE, 'Coral Eel');
    atUpkeep(g, 3);
    strip(g, 0, 10);
    const l0 = lib(g);
    settle(g);
    expect(hand(g).length).toBe(0);
    expect(lib(g)).toBe(l0);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const g = armed(RUMMAGE, 'Coral Eel');
    atUpkeep(g, 3);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [hand(g)[0] as InstanceId] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
