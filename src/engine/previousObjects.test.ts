// D494 - THE PREVIOUS CLAUSE'S OBJECTS. A sentence about `it` / `that card` / `that token` / `those tokens` / `them` whose
// referent is what the clause before it PRODUCED - its targets, the tokens it created, the permanents it put onto the
// battlefield - is read aimless (`ofPrevious`) and bound as it runs: `It gains haste (until end of turn).` (a grant,
// indefinite without the duration - `CardInstance.gained`, CR 611.2c), and the delayed `Sacrifice / Exile / Destroy /
// Return it (to the battlefield under its owner's control | to its owner's hand) at the beginning of the next end step /
// your next upkeep` (armed with the bound aims, `DelayedTrigger.aims`; the fire runs over them). What is proven here: the
// readings; Turn to Mist's flicker (exiled now, back under its owner's control at the next end step - a new object);
// Force of Rage's two tokens sacrificed at the controller's next upkeep; Feral Lightning's tokens exiled at the next end
// step; an indefinite grant that outlasts the turn and ends with the object; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, ofPrevious: e.ofPrevious === true, delayed: e.delay !== null, indefinite: e.indefinite === true })) }; };
const tokensOf = (g: Game, who: 'p1' | 'p2') => g.state.zones.battlefield.filter((id) => g.state.cards[id]?.isToken === true && g.state.cards[id]?.controller === who);
const chars = (g: Game, id: InstanceId) => derive(g.state, deps().oracle, deps().scripts, id);
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

describe("D494 - the previous clause's objects", () => {
  test('the readings: the grant with and without a duration, the delayed forms, and the refusals', () => {
    expect(kinds('Create a 3/3 green Beast creature token. It gains haste until end of turn.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'createToken' }, { kind: 'grantObj', ofPrevious: true, delayed: false, indefinite: false }] });
    expect(kinds('Create a 3/3 green Beast creature token. It gains haste. Sacrifice it at the beginning of the next end step.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'createToken' }, { kind: 'grantObj', ofPrevious: true, indefinite: true }, { kind: 'sacrificeObj', ofPrevious: true, delayed: true }] });
    expect(kinds('Create two 1/1 white Soldier creature tokens. Those tokens gain haste. Exile them at the beginning of the next end step.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'createToken' }, { kind: 'grantObj', ofPrevious: true, indefinite: true }, { kind: 'exileObj', ofPrevious: true, delayed: true }] });
    expect(kinds("Exile target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'exile' }, { kind: 'returnObj', ofPrevious: true, delayed: true }] });
    expect(kinds("Exile target creature. At the beginning of the next end step, return it to the battlefield under its owner's control.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'exile' }, { kind: 'returnObj', ofPrevious: true, delayed: true }] });
    expect(kinds("Create a 3/3 green Beast creature token. Return it to its owner's hand at the beginning of your next upkeep.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'createToken' }, { kind: 'bounceObj', ofPrevious: true, delayed: true }] });
    expect(kinds('Target creature gets +4/+0 until end of turn. Destroy that creature at the beginning of the next end step.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'pump' }, { kind: 'destroyObj', ofPrevious: true, delayed: true }] });
    // Refused: a clause before that produces nothing; a keyword outside the grantable list; a bare `it` sentence the rules do not spell.
    expect(kinds('Draw a card. It gains haste.').effects.map((e) => e.kind), 'a draw produces no object').toEqual(['draw']);
    expect(kinds('Create a 3/3 green Beast creature token. It gains banding.').effects.map((e) => e.kind), 'banding is not grantable').toEqual(['createToken']);
  });

  test("Turn to Mist: the creature is exiled now and returns under its owner's control at the next end step as a new object; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Turn to Mist', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears');
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [bears], tapped: true }));
    const mist = put(g, 'p1', 'Turn to Mist', 'hand');
    main(g, 3);
    mana(g, 'p1', 'WU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mist, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, 'exiled now').toBe('exile');
    expect(g.state.delayedTriggers.some((d) => d.aims?.includes(bears)), 'the return is armed with the card as its aim').toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'end' && s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, 'back at the next end step').toBe('battlefield');
    expect(g.state.cards[bears]?.controller, "under its owner's control").toBe('p2');
    expect(g.state.cards[bears]?.tapped, 'a new object: untapped').toBe(false);
    expect(g.state.delayedTriggers.some((d) => d.aims?.includes(bears)), 'the entry has left').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Force of Rage: two hasty tokens now, sacrificed at the controller's next upkeep; Feral Lightning's three exiled at the next end step", () => {
    const g = startedGame({ players: 2, decks: [['Force of Rage', 'Feral Lightning', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const rage = put(g, 'p1', 'Force of Rage', 'hand');
    const lightning = put(g, 'p1', 'Feral Lightning', 'hand');
    main(g, 3);
    mana(g, 'p1', 'RRR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rage, targets: [] }));
    settle(g);
    const made = tokensOf(g, 'p1');
    expect(made).toHaveLength(2);
    for (const id of made) expect(chars(g, id).keywords.has('haste')).toBe(true);
    expect(g.state.delayedTriggers.filter((d) => d.aims !== undefined && d.aims.length === 2 && d.when.step === 'upkeep' && d.when.whose === 'controller')).toHaveLength(1);
    mana(g, 'p1', 'RRRRRR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: lightning, targets: [] }));
    settle(g);
    const all = tokensOf(g, 'p1');
    expect(all).toHaveLength(5);
    const bolts = all.filter((id) => !made.includes(id));
    expect(bolts).toHaveLength(3);
    // The next end step: the three Feral Lightning tokens go, the Force of Rage pair stays.
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'end' && s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    settle(g);
    for (const id of bolts) expect(g.state.cards[id]?.zone.kind, 'exiled at the next end step').not.toBe('battlefield');
    for (const id of made) expect(g.state.cards[id]?.zone.kind, 'the pair stays through the end step').toBe('battlefield');
    // The opponent's upkeep is not the controller's: the pair stays; p1's next upkeep sacrifices them.
    main(g, 4, 'p2');
    for (const id of made) expect(g.state.cards[id]?.zone.kind).toBe('battlefield');
    main(g, 5);
    for (const id of made) expect(g.state.cards[id]?.zone.kind, "sacrificed at the controller's next upkeep").not.toBe('battlefield');
    expect(g.log.some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => made.includes(m.card) && m.reason === 'sacrifice')), 'a sacrifice, as printed').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an indefinite grant outlasts the turn and ends with the object; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Grizzly Bears'], ['Grizzly Bears']], scripts: createRegistry([entersWith('Grizzly Bears', 'Create a 1/1 red Goblin creature token. It gains flying.')]) });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    settle(g);
    const goblin = tokensOf(g, 'p1')[0] as InstanceId;
    expect(goblin).toBeDefined();
    expect(chars(g, goblin).keywords.has('flying'), 'gained now').toBe(true);
    expect(g.state.cards[goblin]?.gained).toEqual(['flying']);
    main(g, 5);
    expect(chars(g, goblin).keywords.has('flying'), 'still flying two turns on: no duration was printed').toBe(true);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: goblin, to: { kind: 'exile', player: 'p1' } }));
    expect(g.state.cards[goblin]?.gained, 'the grant ends with the object').toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  // D495 - THE OBJECT ROWS. A token maker's objects are the tokens it made, never the creature it copied: the copy of a
  // target Bears gains haste and is sacrificed at the next end step, and the Bears it copied stays untouched. A clause
  // before that ASKS (a payment whose body makes the token) produces its objects only after the answer: refused.
  test("a copy of a target: the copy alone gains the keyword and goes at the end step, the creature it copied stays; the asking clause before refuses", () => {
    expect(kinds("Create a token that's a copy of target creature you control. It gains haste. Sacrifice it at the beginning of the next end step.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'createToken' }, { kind: 'grantObj', ofPrevious: true, indefinite: true }, { kind: 'sacrificeObj', ofPrevious: true, delayed: true }] });
    expect(kinds("You may pay {1}{R}. If you do, create a token that's a copy of target creature. It gains haste.").mode, 'the payment answers first: the objects are unknown at the clause').not.toBe('auto');
    // The copied creature is a Coral Eel, not another Bears: a copy of the Bears would carry this very trigger and copy on.
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Coral Eel'], ['Grizzly Bears']], scripts: createRegistry([entersWith('Grizzly Bears', "Create a token that's a copy of target creature you control. It gains haste. Sacrifice it at the beginning of the next end step.")]) });
    holdEverywhere(g);
    const model = put(g, 'p1', 'Coral Eel');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null), 20_000);
    if (g.state.priority.awaiting?.kind === 'chooseTargets') must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: model }] }));
    settle(g);
    const copy = tokensOf(g, 'p1')[0] as InstanceId;
    expect(copy, 'the copy was made').toBeDefined();
    expect(chars(g, copy).keywords.has('haste'), 'the copy gained haste').toBe(true);
    expect(chars(g, model).keywords.has('haste'), 'the creature it copied did not').toBe(false);
    const armedFor = g.state.delayedTriggers.find((d) => d.aims !== undefined);
    expect(armedFor?.aims, 'armed with the copy alone').toEqual([copy]);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'end' && s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    settle(g);
    expect(g.state.cards[copy]?.zone.kind, 'the copy is sacrificed at the end step').not.toBe('battlefield');
    expect(g.state.cards[model]?.zone.kind, 'the creature it copied stays').toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
