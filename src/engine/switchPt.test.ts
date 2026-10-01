// D604 - THE SWITCH WITH AN END. `Switch target creature's power and toughness until end of turn.` (About Face, Twisted
// Image, Merfolk Thaumaturgist ...) and its self form `Switch this creature's power and toughness until end of turn.`
// (Aquamoeba, Crag Puca, Turtleshell Changeling ...) - CR 613.4d: a switch applies in layer 7d, after every effect that
// sets or modifies power and toughness and after the counters. The mark rides the until-end-of-turn entry D394's
// `cantBlock` rides (power 0 / toughness 0, cleared at cleanup): `switchPt`, read by `derive` last. What is proven: the
// vocabulary reads both; a 5/2 target is a 2/5 for the turn and a 5/2 again after cleanup; a 0/4 that switches itself is a
// 4/0 the state-based actions put into the graveyard; the hash.
import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { InstanceId } from './types/ids';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const TARGET = "Switch target creature's power and toughness until end of turn.";
const SELF = "Switch this creature's power and toughness until end of turn.";
const ptOf = (g: Game, id: InstanceId) => { const d = derive(g.state, g.deps.oracle, g.deps.scripts, id); return `${d.power}/${d.toughness}`; };

/** An upkeep head on `name` whose payload the vocabulary reads (the generated vocab shape). */
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
      targets,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

describe('D604 - the switch with an end', () => {
  test('the vocabulary reads both', () => {
    expect(vocabularyEffects(TARGET, 'About Face').map((e) => [e.kind, e.targetIndex])).toEqual([['switchPt', 0]]);
    expect(vocabularyTargets(TARGET)).toHaveLength(1);
    expect(vocabularyEffects(SELF, 'Aquamoeba').map((e) => [e.kind, e.self])).toEqual([['switchPt', true]]);
  });

  test('a 5/2 target is a 2/5 for the turn, and a 5/2 again after cleanup', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', ...TEN], ['Cyclops of One-Eyed Pass', ...TEN]], scripts: createRegistry([head('Grizzly Bears', TARGET)]) });
    settle(g);
    holdEverywhere(g);
    put(g, 'p1', 'Grizzly Bears');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    expect(ptOf(g, cyclops)).toBe('5/2');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.untilEndOfTurn.some((m) => m.card === cyclops && m.switchPt === true)).toBe(true);
    expect(ptOf(g, cyclops), 'switched for the turn').toBe('2/5');
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 20_000);
    expect(ptOf(g, cyclops), 'cleanup ends it').toBe('5/2');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a 0/4 that switches itself is a 4/0 the state-based actions put into the graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Steel Wall', ...TEN], ['Grizzly Bears', ...TEN]], scripts: createRegistry([head('Steel Wall', SELF)]) });
    settle(g);
    holdEverywhere(g);
    const wall = put(g, 'p1', 'Steel Wall');
    settle(g);
    expect(ptOf(g, wall)).toBe('0/4');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'draw', 20_000);
    expect(g.state.cards[wall]?.zone.kind, 'a 4/0 dies (CR 704.5f)').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
