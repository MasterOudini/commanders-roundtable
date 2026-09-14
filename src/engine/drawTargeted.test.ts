// D433 - THE TARGETED AND SCOPED DRAW: `Target player draws a card.` draws for the aimed player (the draw-step heads'
// referent - Font of Mythos's `that player draws two additional cards`), `Each player draws a card.` draws for every
// player in APNAP order, and a subjectless right half after a player subject (`Target player draws a card, then
// discards a card.`) is THAT player's discard, asked of them - never the controller's own.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
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
const FONT = head('Grizzly Bears', 'Target player draws two cards.');
const LOOTER = head('Coral Eel', 'Target player draws a card, then discards a card.');
const ALL = head('Grizzly Bears', 'Each player draws a card.');
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];

function armed(script: CardScript, name: string): Game {
  const g = startedGame({ players: 2, decks: [[name, ...TEN, ...TEN], [...TEN, ...TEN]], scripts: createRegistry([script]) });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', name);
  settle(g);
  return g;
}
const hand = (g: Game, p: string): number => g.state.zones.hand[p]?.length ?? 0;

describe('the targeted and scoped draw (D433)', () => {
  test('the vocabulary reads the aimed draw, the scoped draw and the continued subject', () => {
    const aimed = parseEffects('Target player draws two cards.', 'Font', true);
    expect(aimed.mode).toBe('auto');
    expect(aimed.effects.map((e) => [e.kind, e.amount, e.targetIndex, e.self])).toEqual([['draw', 2, 0, false]]);
    const scoped = parseEffects('Each opponent draws a card.', 'Font', true);
    expect(scoped.mode).toBe('auto');
    expect(scoped.effects[0]?.scopes).toEqual([{ kind: 'player', controller: 'opponents' }]);
    // The right half has no subject of its own: it is the targeted player's discard, aimed where the draw aimed.
    const loot = parseEffects('Target player draws a card, then discards a card.', 'Looter', true);
    expect(loot.mode).toBe('auto');
    expect(loot.effects.map((e) => [e.kind, e.targetIndex, e.referent === true])).toEqual([['draw', 0, false], ['discard', 0, true]]);
    // The caster's own subjectless sentence keeps its reading.
    const own = parseEffects('Draw a card, then discard a card.', 'Looter', true);
    expect(own.effects.map((e) => [e.kind, e.self])).toEqual([['draw', true], ['discard', true]]);
  });

  test("the aimed draw draws for the active player at their draw step, not the controller", () => {
    const g = armed(FONT, 'Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'draw', 20_000);
    const p1 = hand(g, 'p1');
    const p2 = hand(g, 'p2');
    settle(g);
    // The turn's own draw already happened when the step began; the head adds two for p2 and none for p1.
    expect(hand(g, 'p2')).toBe(p2 + 2);
    expect(hand(g, 'p1')).toBe(p1);
  });

  test('the continued discard is asked of the drawing player', () => {
    const g = armed(LOOTER, 'Coral Eel');
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'draw', 20_000);
    const p2 = hand(g, 'p2');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'chooseFromZone' ? ask.player : null).toBe('p2');
    expect(hand(g, 'p2')).toBe(p2 + 1);
  });

  test('the scoped draw draws for every player', () => {
    const g = armed(ALL, 'Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'draw', 20_000);
    const p1 = hand(g, 'p1');
    const p2 = hand(g, 'p2');
    settle(g);
    expect(hand(g, 'p1')).toBe(p1 + 1);
    expect(hand(g, 'p2')).toBe(p2 + 1);
  });

  test('replays to the same hash', () => {
    const g = armed(LOOTER, 'Coral Eel');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    const pick = ask?.kind === 'chooseFromZone' ? (g.state.zones.hand[ask.player] ?? []).slice(0, 1) : [];
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [...pick] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
