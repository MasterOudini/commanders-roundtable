// D439 - THE SCOPED LIFE LOSS: `Each player loses N life.` / `Each opponent loses N life.` (D434's mill shape one verb
// over - every member of the player scope, APNAP) and the drain rider `You gain life equal to the life lost this way.`

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, put, startedGame, ORACLE } from './testing/harness';
import { parseEffects } from '../data/effectParse';
import type { CardScript } from './scripts/api';
import type { Game } from './game';

const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
/** A testing def on a fixture creature: at its controller's upkeep, the sentence resolves through the vocabulary. */
function script(name: string, sentence: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'loss-0', text: sentence, event: 'StepBegan', activeZones: ['battlefield'], optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => name + ' - ' + sentence,
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects(sentence, name), []),
    }],
  };
}
/** Three seats at 40 life; p1 holds the Bears from turn 1; the game walks past p1's second upkeep (turn 4). */
function played(sentence: string): Game {
  const g = startedGame({ players: 3, decks: [['Grizzly Bears', ...TEN], TEN, TEN], scripts: createRegistry([script('Grizzly Bears', sentence)]) });
  advanceUntil(g, (x) => x.stack.length === 0 && x.pendingTriggers.length === 0 && x.priority.awaiting === null, 20_000);
  holdEverywhere(g);
  put(g, 'p1', 'Grizzly Bears');
  advanceUntil(g, (x) => x.turn.turnNumber === 4 && x.turn.step === 'draw', 30_000);
  return g;
}
const lives = (g: Game): number[] => ['p1', 'p2', 'p3'].map((p) => g.state.players[p]?.life ?? -1);

describe('the scoped life loss (D439)', () => {
  test('the vocabulary reads both scopes and the drain rider, and leaves the conjunction alone', () => {
    const one = parseEffects('Each player loses 2 life.', 'T', true);
    expect(one.mode).toBe('auto');
    expect(one.effects[0]).toMatchObject({ kind: 'loseLife', amount: 2, self: true, scopes: [{ kind: 'player', controller: 'any' }] });
    expect(one.effects[0]?.gainLost).toBeUndefined();
    const drain = parseEffects('Each opponent loses 5 life. You gain life equal to the life lost this way.', 'T', true);
    expect(drain.mode).toBe('auto');
    expect(drain.effects).toHaveLength(1);
    expect(drain.effects[0]).toMatchObject({ kind: 'loseLife', amount: 5, scopes: [{ kind: 'player', controller: 'opponents' }], gainLost: true });
    expect(parseEffects('Each opponent loses 1 life and you gain 1 life.', 'T', true).mode).toBe('auto');
    expect(parseEffects('Each player loses life equal to the number of cards in their hand.', 'T', true).mode).not.toBe('auto');
  });

  test('`Each player loses 2 life.`: every seat, the active player first', () => {
    const g = played('Each player loses 2 life.');
    expect(lives(g)).toEqual([38, 38, 38]);
    const losses = g.log.filter((e) => e.body.t === 'LifeChanged' && e.body.delta === -2).map((e) => (e.body.t === 'LifeChanged' ? e.body.player : ''));
    expect(losses).toEqual(['p1', 'p2', 'p3']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('`Each opponent loses 5 life. You gain life equal to the life lost this way.`: the opponents pay, the caster gains the sum', () => {
    const g = played('Each opponent loses 5 life. You gain life equal to the life lost this way.');
    expect(lives(g)).toEqual([50, 35, 35]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
