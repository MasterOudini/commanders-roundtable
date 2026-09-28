// D579 - TRANSFORM (CR 701.28): `Transform this creature.` is a self kind - the resolving ability's source turned to its
// other face (a FaceIndexSet: no zone change). What is proven here: the reading (the self forms read, a sentence about
// something else does not); on a test script over Ulvenwald Captive // Ulvenwald Abomination - the activated transform
// turns it (the 4/6 back face, its counters kept), and two activations on the stack transform it ONCE (the second finds its
// face gone - CR 701.28c, `transformFrom`); a daybound permanent does not transform by an effect (702.145); the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { createRegistry } from './scripts/registryCore';
import { transformFrom, vocabularyEffects } from './scripts/vocabulary';
import type { CardScript } from './scripts/api';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { EventBody } from './types/events';

const CAPTIVE = 'Ulvenwald Captive // Ulvenwald Abomination';
const RUFFIAN = 'Tavern Ruffian // Tavern Smasher';
const cardOf = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return c; };
const captive = cardOf(CAPTIVE);
const IDX = faceOf(captive, 0).activated.findIndex((a) => /Transform/i.test(a.effectText));

const CAPTIVE_SCRIPT: CardScript = {
  oracleId: captive.oracleId,
  name: CAPTIVE,
  activated: [
    {
      ref: `${captive.oracleId}#a${IDX}`,
      text: '{5}{G}{G}: Transform this creature.',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, transformFrom(vocabularyEffects('Transform this creature.', CAPTIVE), 0), []),
    },
  ],
};
const RUFFIAN_SCRIPT: CardScript = {
  oracleId: cardOf(RUFFIAN).oracleId,
  name: RUFFIAN,
  triggers: [
    {
      abilityId: 't0',
      text: 'TEST: whenever another creature enters, transform this creature.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card !== self && m.to.kind === 'battlefield'),
      label: () => 'TEST - transform',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, vocabularyEffects('Transform this creature.', RUFFIAN), []),
    },
  ],
};

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, sym: 'G' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const pt = (g: Game, id: string) => { const d = deps(createRegistry([CAPTIVE_SCRIPT])); const c = derive(g.state, d.oracle, d.scripts, id); return [c.power, c.toughness]; };

describe('D579 - transform', () => {
  test('the reading: the self forms, and not a sentence about something else', () => {
    for (const t of ['Transform this creature.', 'Transform this artifact.', 'Transform ~.', 'Then transform it.']) {
      const e = vocabularyEffects(t, 'Test');
      expect([e.length, e[0]?.kind, e[0]?.self], t).toEqual([1, 'transform', true]);
    }
    expect(parseEffects('Transform target creature.', 'Test', true).effects.some((e) => e.kind === 'transform'), 'a target is not the self form').toBe(false);
    expect(transformFrom(vocabularyEffects('Transform this creature.', 'Test'), 1)[0]?.transformFrom, 'the face that prints it').toBe(1);
    expect(IDX, 'Ulvenwald Captive prints its transform').toBeGreaterThanOrEqual(0);
  });

  test('the activated transform turns the Captive; two on the stack transform it once (CR 701.28c)', () => {
    const g = startedGame({ players: 2, decks: [[CAPTIVE, 'Forest', 'Forest'], ['Forest']], scripts: createRegistry([CAPTIVE_SCRIPT]) });
    holdEverywhere(g);
    const self = put(g, 'p1', CAPTIVE, 'battlefield');
    main3(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: '+1/+1', delta: 1 }));
    expect(pt(g, self), 'Ulvenwald Captive 1/2 and its counter').toEqual([2, 3]);
    mana(g, 'G', 2);
    mana(g, 'C', 5);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: IDX }));
    settle(g);
    expect(g.state.cards[self]?.faceIndex).toBe(1);
    expect(pt(g, self), 'Ulvenwald Abomination 4/6, the counter kept').toEqual([5, 7]);
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: self }));
    settle(g);
    expect(g.state.cards[self]?.faceIndex).toBe(0);
    mana(g, 'G', 4);
    mana(g, 'C', 10);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: IDX }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: IDX }));
    expect(g.state.stack, 'two transforms on the stack').toHaveLength(2);
    settle(g);
    expect(g.state.cards[self]?.faceIndex, 'transformed once, not back').toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a daybound permanent does not transform by an effect', () => {
    const g = startedGame({ players: 2, decks: [[RUFFIAN, 'Grizzly Bears', 'Mountain'], ['Mountain']], scripts: createRegistry([RUFFIAN_SCRIPT]) });
    holdEverywhere(g);
    const self = put(g, 'p1', RUFFIAN, 'battlefield');
    settle(g);
    put(g, 'p1', 'Grizzly Bears', 'battlefield');
    settle(g);
    expect(g.log.some((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self), 'the trigger resolved').toBe(true);
    expect(g.state.cards[self]?.faceIndex, 'still the front face').toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
