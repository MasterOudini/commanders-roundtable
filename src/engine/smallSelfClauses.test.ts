// D602 - THREE CLAUSES THE VOCABULARY MISSED BY A WORD. `Return this Aura to its owner's hand.` (Cage of Hands, Whip Silk,
// Conviction - the Aura's own bounce; the self forms named a creature, a permanent, an artifact, an enchantment, a land,
// a card, never `this Aura`); `Remove a +1/+1 counter from this creature.` (Karstoderm, Belligerent Hatchling, Magmaroth -
// the counter removal read only a target); `~ deals 2 damage to any target and 3 damage to you.` (Orcish Artillery,
// Brothers of Fire - D426's conjunction found no verb in the right half: the subject and the verb continue). What is
// proven: the three readings; an upkeep trigger removes the card's own counter; the hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const BEARS = 'Grizzly Bears';

/** An upkeep head on Grizzly Bears whose payload the vocabulary reads (the generated vocab shape). */
function head(payload: string): CardScript {
  const card = ORACLE.byName(BEARS);
  if (!card) throw new Error('Grizzly Bears is not in the fixtures');
  const effects = vocabularyEffects(payload, BEARS);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name: BEARS,
    triggers: [{
      abilityId: 'upkeep-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => BEARS + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

describe('D602 - three clauses missed by a word', () => {
  test("`Return this Aura to its owner's hand.` is the Aura's own return", () => {
    const effects = vocabularyEffects("Return this Aura to its owner's hand.", 'Cage of Hands');
    expect(effects.map((e) => e.kind)).toEqual(['returnSelf']);
    expect(effects[0]?.self).toBe(true);
  });

  test('`Remove a +1/+1 counter from this creature.` removes the source' + "'" + 's own counter', () => {
    const plus = vocabularyEffects('Remove a +1/+1 counter from this creature.', 'Karstoderm');
    expect(plus.map((e) => [e.kind, e.self, e.amount, e.counterKind])).toEqual([['removeCounters', true, 1, '+1/+1']]);
    const minus = vocabularyEffects('Remove a -1/-1 counter from this creature.', 'Belligerent Hatchling');
    expect(minus.map((e) => [e.kind, e.self, e.amount, e.counterKind])).toEqual([['removeCounters', true, 1, '-1/-1']]);
  });

  test('`~ deals 2 damage to any target and 3 damage to you.` is two clauses: the target, then the controller', () => {
    const effects = vocabularyEffects('~ deals 2 damage to any target and 3 damage to you.', 'Orcish Artillery');
    expect(effects.map((e) => [e.kind, e.amount])).toEqual([['damage', 2], ['damageEach', 3]]);
    expect(effects[1]?.scopes).toEqual([{ kind: 'player', controller: 'you' }]);
    expect(vocabularyTargets('~ deals 2 damage to any target and 3 damage to you.')).toHaveLength(1);
  });

  test("an upkeep trigger removes one of the card's own counters", () => {
    const g = startedGame({ players: 2, decks: [[BEARS, ...TEN], ['Walking Corpse', ...TEN]], scripts: createRegistry([head('Remove a +1/+1 counter from this creature.')]) });
    settle(g);
    holdEverywhere(g);
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 2 }));
    settle(g);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 40_000);
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
