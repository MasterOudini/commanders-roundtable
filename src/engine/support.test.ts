// D605 - SUPPORT N (CR 701.41a): "Put a +1/+1 counter on each of up to N other target creatures" on a permanent, "each of
// up to N target creatures" on an instant or sorcery - the keyword action names its targets only in its reminder text, so
// the target clause is read off the printed `Support N` (at its place among the face's other clauses) and the effect is
// D299's counted put. On a spell `other` excludes nothing: the source is a spell, never a creature on the battlefield.
// What is proven: the vocabulary and the target reader agree on both shapes; an upkeep head puts a counter on each of two
// creatures, one an opponent's; the source cannot target itself; zero targets is a legal declaration; the hash.
import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from '../data/targetParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const SUPPORT = 'support 2.';

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

function supportGame(): { g: Game; bears: string; goblin: string; cyclops: string } {
  const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Raging Goblin', ...TEN], ['Cyclops of One-Eyed Pass', ...TEN]], scripts: createRegistry([head('Grizzly Bears', SUPPORT)]) });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  const goblin = put(g, 'p1', 'Raging Goblin');
  const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears, goblin, cyclops };
}

describe('D605 - support N', () => {
  test('the vocabulary and the target reader agree', () => {
    expect(vocabularyEffects(SUPPORT, 'Saddleback Lagac').map((e) => [e.kind, e.counterKind, e.amount, e.targetIndex])).toEqual([['putCounters', '+1/+1', 1, 0]]);
    const [clause] = vocabularyTargets(SUPPORT);
    expect([clause?.min, clause?.max, clause?.kinds, clause?.another]).toEqual([0, 2, ['creature'], true]);
    // On a spell, among the face's other clauses, in printed order.
    const two = parseTargetClauses('Support 2. Tap target creature an opponent controls.');
    expect(two.map((c) => [c.max, c.controller])).toEqual([[2, 'any'], [1, 'opponent']]);
  });

  test('a counter on each of two creatures, one of them an opponent' + String.fromCharCode(39) + 's', () => {
    const { g, goblin, cyclops } = supportGame();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: goblin }, { kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[goblin]?.counters['+1/+1']).toBe(1);
    expect(g.state.cards[cyclops]?.counters['+1/+1']).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the source is not among its own targets, and none is a legal declaration', () => {
    const { g, bears } = supportGame();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok, 'other target creatures').toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
