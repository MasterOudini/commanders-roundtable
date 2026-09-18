// D497 - THE END-OF-COMBAT STEP. `at end of combat` is a delayed trigger like `at the beginning of the next end step`
// (CR 603.7): the entry fires at the first end-of-combat step to begin after its arming - this turn's when armed in
// combat. And a delayed clause may be aimed now: at the SOURCE (`Sacrifice it at end of combat` - Fog Elemental, a
// bounce, a counter, `Destroy it`), which the fire finds where it stands, or at ONE TARGET (`Destroy target creature at
// end of combat`), which the executor arms the entry WITH (`DelayedTrigger.aims`, D494's carrier) - an object that has
// left the zone the verb needs does nothing. What is proven here: the readings; an attacker sacrificed at its own
// combat's end and one bounced; a target destroyed at end of combat, and one that left first left alone; the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, self: e.self, targetIndex: e.targetIndex, delay: e.delay })) }; };
/** An attacks trigger on a fixture whose payload is the given text. */
function attacksWith(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId, name,
    triggers: [{
      abilityId: 'attacks-0', text: card.faces[0]?.oracleText ?? '', event: 'AttackersDeclared', activeZones: ['battlefield'], optional: false, targets,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => name + ' - ' + payload.slice(0, 30),
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
/** An enters trigger on a fixture whose payload is the given text. */
function entersWith(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId, name,
    triggers: [{
      abilityId: 'etb-0', text: card.faces[0]?.oracleText ?? '', event: 'CardsMoved', activeZones: ['battlefield'], optional: false, targets,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
      label: () => name + ' - ' + payload.slice(0, 30),
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
const endOfCombat = (g: Game, turn: number) => { advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.step === 'endCombat' && s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 40_000); settle(g); };

describe('D497 - the end-of-combat step, and a delayed clause aimed at the source or a target', () => {
  test('the readings: the source forms, the targeted form, the step; the refusals stand', () => {
    expect(kinds('Sacrifice it at end of combat.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'sacrificeSelf', self: true, delay: { step: 'endCombat', whose: 'next' } }] });
    expect(kinds("Return ~ to its owner's hand at end of combat.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'bounce', self: true, delay: { step: 'endCombat', whose: 'next' } }] });
    expect(kinds('Put a -1/-1 counter on ~ at end of combat.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'putCounters', self: true, delay: { step: 'endCombat', whose: 'next' } }] });
    expect(kinds('Destroy ~ at end of combat.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'destroy', self: true, delay: { step: 'endCombat', whose: 'next' } }] });
    expect(kinds('Destroy target creature at end of combat.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'destroy', self: false, targetIndex: 0, delay: { step: 'endCombat', whose: 'next' } }] });
    expect(kinds("Return target creature to its owner's hand at end of combat.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'bounce', targetIndex: 0, delay: { step: 'endCombat', whose: 'next' } }] });
    expect(kinds('Create a 1/1 red Goblin creature token. Exile that token at end of combat.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'createToken' }, { kind: 'exileObj', delay: { step: 'endCombat', whose: 'next' } }] });
    expect(kinds('Sacrifice ~ at the beginning of the next end step.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'sacrificeSelf', delay: { step: 'end', whose: 'next' } }] });
    // Refused: an ask, a payment, a second operand, a count.
    expect(kinds('Target creature fights ~ at end of combat.').mode, 'a second operand').not.toBe('auto');
    expect(kinds('Draw a card for each creature you control at the beginning of the next end step.').mode, 'a count').not.toBe('auto');
  });

  test('an attacker is sacrificed at its own combat\'s end, another is bounced; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Coral Eel'], ['Grizzly Bears']], scripts: createRegistry([attacksWith('Grizzly Bears', 'Sacrifice it at end of combat.'), attacksWith('Coral Eel', "Return it to its owner's hand at end of combat.")]) });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const eel = put(g, 'p1', 'Coral Eel');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }, { card: eel, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    expect(g.state.delayedTriggers.filter((d) => d.when.step === 'endCombat'), 'two entries armed for this combat').toHaveLength(2);
    expect(g.state.cards[bears]?.zone.kind, 'still attacking').toBe('battlefield');
    endOfCombat(g, 3);
    expect(g.state.cards[bears]?.zone.kind, 'sacrificed at end of combat').toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === bears && m.reason === 'sacrifice')), 'a sacrifice, as printed').toBe(true);
    expect(g.state.cards[eel]?.zone.kind, "bounced to its owner's hand").toBe('hand');
    expect(g.state.delayedTriggers.filter((d) => d.when.step === 'endCombat'), 'both entries fired').toHaveLength(0);
    expect(g.state.players.p2?.life, 'the attack landed first').toBe(40 - 4);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a target is destroyed at end of combat; one that left the battlefield first is left alone; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Grizzly Bears'], ['Coral Eel', 'Coral Eel']], scripts: createRegistry([entersWith('Grizzly Bears', 'Destroy target creature at end of combat.')]) });
    holdEverywhere(g);
    const eelA = put(g, 'p2', 'Coral Eel');
    const eelB = put(g, 'p2', 'Coral Eel');
    const bearsA = put(g, 'p1', 'Grizzly Bears', 'hand');
    const bearsB = put(g, 'p1', 'Grizzly Bears', 'hand');
    main(g, 3);
    for (const [bears, eel] of [[bearsA, eelA], [bearsB, eelB]] as const) {
      mana(g, 'p1', 'GG');
      must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
      must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: eel }] }));
      settle(g);
    }
    const armed = g.state.delayedTriggers.filter((d) => d.when.step === 'endCombat');
    expect(armed.map((d) => d.aims), 'each entry armed with its own pick').toEqual([[eelA], [eelB]]);
    expect(new Set(armed.map((d) => d.id)).size, 'two entries, two ids').toBe(2);
    // The second target leaves before the step: a new object would stand where it stood, and the fire says nothing about it.
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: eelB, to: { kind: 'hand', player: 'p2' } }));
    expect(g.state.cards[eelA]?.zone.kind, 'nothing yet').toBe('battlefield');
    endOfCombat(g, 3);
    expect(g.state.cards[eelA]?.zone.kind, 'destroyed at end of combat').toBe('graveyard');
    expect(g.state.cards[eelB]?.zone.kind, 'the one that left stays where it went').toBe('hand');
    expect(g.state.delayedTriggers.filter((d) => d.when.step === 'endCombat'), 'both entries fired').toHaveLength(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
