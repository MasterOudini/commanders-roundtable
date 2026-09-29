// WHAT A STACK CLAUSE MAY AIM AT. A spell is a card on the stack, and a copy of one is a spell too (CR 112.1a); an
// activated or triggered ability on the stack is an object of its own and never a spell (CR 113.1c). So `target spell`
// (Counterspell) aims at spells alone, `target activated or triggered ability` (Stifle) at abilities alone, and `target
// spell or ability` - Disallow's `spell, activated ability, or triggered ability` too - at either. And a spell or
// ability on the stack is an illegal target for itself (CR 115.5): the two objects aimed while already on the stack - a
// trigger (CR 603.3d) and a copy asked for new targets (CR 707.10c) - never accept their own stack id. What is proven
// here: Counterspell refused at an activated ability (the ping still resolves) and at a triggered one (a conspire cast
// trigger), the spell beneath it still legal; the parsed clauses of the three shapes against a live stack; Reverberate's
// copy of a Counterspell refused as its own new target, the original accepted; a trigger that aims at abilities refused
// as its own target, another ability accepted; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from '../data/targetParse';
import { createRegistry } from './scripts/registryCore';
import { MYSTIC_SNAKE_SCRIPT } from './scripts/cards/mysticSnake';
import { PRODIGAL_PYROMANCER_SCRIPT } from './scripts/cards/prodigalPyromancer';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { candidatesFromState, legalTargetsFor, validateTargets, type TargetingSource } from './targets';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { StackId } from './types/ids';
import type { TargetChoice } from './types/state';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? -1;
const top = (g: Game) => g.state.stack[g.state.stack.length - 1]?.id as StackId;
const onStack = (id: StackId): TargetChoice => ({ kind: 'stack', id });
const refusal = (r: ReturnType<Game['submit']>) => (r.ok ? 'accepted' : r.reason);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const printedClauses = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0).targets; };

/** p1 casts Burn Trail at p2, conspired: the spell and its conspire cast trigger on the stack, p2 to act. */
function conspiredTrail(): { g: Game; spell: StackId; trigger: StackId; counter: string } {
  const g = startedGame({ players: 2, decks: [['Burn Trail', 'Hill Giant', 'Raging Goblin'], ['Counterspell']] });
  holdEverywhere(g);
  const trail = put(g, 'p1', 'Burn Trail', 'hand');
  const giant = put(g, 'p1', 'Hill Giant');
  const goblin = put(g, 'p1', 'Raging Goblin');
  const counter = put(g, 'p2', 'Counterspell', 'hand');
  main3(g);
  mana(g, 'p1', 'RCCC');
  must(g.submit({ t: 'CastSpell', player: 'p1', card: trail, targets: [{ kind: 'player', id: 'p2' }], conspired: true, tap: [giant, goblin] }));
  expect(g.state.stack.map((o) => o.kind), 'Burn Trail and its conspire trigger').toEqual(['spell', 'triggered']);
  const [spell, trigger] = g.state.stack.map((o) => o.id) as [StackId, StackId];
  must(g.submit({ t: 'PassPriority', player: 'p1' }));
  expect(g.state.priority.player).toBe('p2');
  return { g, spell, trigger, counter };
}

describe('a spell target is a spell, an ability target an ability, and nothing aims at itself', () => {
  test('Counterspell cannot counter an activated ability: refused at the cast, and the ping resolves', () => {
    const g = startedGame({ players: 2, decks: [['Prodigal Pyromancer'], ['Counterspell']], scripts: createRegistry([PRODIGAL_PYROMANCER_SCRIPT]) });
    holdEverywhere(g);
    const tim = put(g, 'p1', 'Prodigal Pyromancer');
    const counter = put(g, 'p2', 'Counterspell', 'hand');
    main3(g);
    const p2Life = life(g, 'p2');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tim, abilityIndex: 0, targets: [{ kind: 'player', id: 'p2' }] }));
    const ping = top(g);
    expect(g.state.stack.find((o) => o.id === ping)?.kind).toBe('activated');
    must(g.submit({ t: 'PassPriority', player: 'p1' }));
    expect(g.state.priority.player).toBe('p2');
    mana(g, 'p2', 'UU');
    expect(refusal(g.submit({ t: 'CastSpell', player: 'p2', card: counter, targets: [onStack(ping)] })), 'an activated ability is not a spell').toBe('illegalTarget');
    settle(g);
    expect(g.log.some((e) => e.body.t === 'SpellCountered'), 'nothing was countered').toBe(false);
    expect(life(g, 'p2'), 'the ping resolved').toBe(p2Life - 1);
    expect(g.state.cards[counter]?.zone.kind, 'Counterspell never left the hand').toBe('hand');
    hashHolds(g);
  });

  test('Counterspell cannot counter a triggered ability: the conspire trigger is refused, the spell beneath it is not', () => {
    const { g, spell, trigger, counter } = conspiredTrail();
    mana(g, 'p2', 'UU');
    expect(refusal(g.submit({ t: 'CastSpell', player: 'p2', card: counter, targets: [onStack(trigger)] })), 'a triggered ability is not a spell').toBe('illegalTarget');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: counter, targets: [onStack(spell)] }));
    settle(g);
    const countered = g.log.flatMap((e) => (e.body.t === 'SpellCountered' ? [e.body.stackId] : []));
    expect(countered, 'Counterspell countered Burn Trail, never the trigger').toEqual([spell]);
    hashHolds(g);
  });

  test('the clauses over a live stack: a spell, an ability, or either - and Counterspell' + "'" + 's printed clause', () => {
    const { g, spell, trigger } = conspiredTrail();
    const candidates = candidatesFromState(g.state, deps());
    const src: TargetingSource = { controller: 'p2', colors: ['U'] };
    const stackAims = (text: string) => {
      const specs = parseTargetClauses(text);
      expect(specs, text).toHaveLength(1);
      return legalTargetsFor(specs[0]!, src, candidates).flatMap((c) => (c.kind === 'stack' ? [c.id] : [])).sort();
    };
    expect(stackAims('Counter target spell.'), 'a spell alone').toEqual([spell]);
    expect(stackAims('Counter target activated or triggered ability.'), 'an ability alone').toEqual([trigger]);
    expect(stackAims('Counter target spell or ability.'), 'either').toEqual([spell, trigger].sort());
    expect(stackAims('Counter target spell, activated ability, or triggered ability.'), 'Disallow' + "'" + 's list: either').toEqual([spell, trigger].sort());
    const counterspell = printedClauses('Counterspell');
    expect(legalTargetsFor(counterspell[0]!, src, candidates).filter((c) => c.kind === 'stack').map((c) => c.id), 'Counterspell').toEqual([spell]);
    const stifle = parseTargetClauses('Counter target activated or triggered ability.');
    expect(validateTargets(stifle, src, 'Stifle', [onStack(trigger)], candidates).ok, 'Stifle at the trigger').toBe(true);
    expect(validateTargets(stifle, src, 'Stifle', [onStack(spell)], candidates).ok, 'Stifle at the spell').toBe(false);
  });

  test('a copy' + "'" + 's new target is never the copy itself (CR 115.5): Reverberate copies a Counterspell', () => {
    const g = startedGame({ players: 2, decks: [['Counterspell', 'Reverberate'], ['Lightning Bolt']] });
    holdEverywhere(g);
    const counter = put(g, 'p1', 'Counterspell', 'hand');
    const rev = put(g, 'p1', 'Reverberate', 'hand');
    const boltCard = put(g, 'p2', 'Lightning Bolt', 'hand');
    main3(g);
    must(g.submit({ t: 'PassPriority', player: 'p1' }));
    mana(g, 'p2', 'R');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: boltCard, targets: [{ kind: 'player', id: 'p1' }] }));
    const bolt = top(g);
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    expect(g.state.priority.player).toBe('p1');
    mana(g, 'p1', 'UU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: counter, targets: [onStack(bolt)] }));
    const original = top(g);
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [onStack(original)] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets' && s.priority.awaiting.forKind === 'copy', 20_000);
    const ask = g.state.priority.awaiting;
    if (ask?.kind !== 'chooseTargets') throw new Error('no copy prompt');
    const copy = ask.stackId;
    expect(g.state.stack.find((o) => o.id === copy)?.copyOf, 'the copy is on the stack as it is aimed').toBeDefined();
    expect(refusal(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [onStack(copy)] })), 'a spell on the stack is an illegal target for itself').toBe('illegalTarget');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [onStack(original)] }));
    settle(g);
    const countered = g.log.flatMap((e) => (e.body.t === 'SpellCountered' ? [e.body.stackId] : []));
    expect(countered, 'the copy countered the original Counterspell - never itself').toEqual([original]);
    expect(life(g, 'p1'), 'so the Bolt resolved').toBe(37);
    hashHolds(g);
  });

  test('a trigger aimed on the stack is never its own target (CR 115.5); another ability is', () => {
    // A trigger whose clause aims at abilities: Mystic Snake's entry, its clause read as Stifle's. Mystic Snake's own
    // resolution counters spells only, so the ping it aims at still resolves - what is proven is the aim.
    const snake = MYSTIC_SNAKE_SCRIPT.triggers?.[0];
    if (!snake) throw new Error('Mystic Snake has no trigger');
    const stifling = { ...MYSTIC_SNAKE_SCRIPT, triggers: [{ ...snake, targets: parseTargetClauses('When this creature enters, counter target activated or triggered ability.') }] };
    const g = startedGame({ players: 2, decks: [['Mystic Snake'], ['Prodigal Pyromancer']], scripts: createRegistry([stifling, PRODIGAL_PYROMANCER_SCRIPT]) });
    holdEverywhere(g);
    const tim = put(g, 'p2', 'Prodigal Pyromancer');
    main3(g);
    must(g.submit({ t: 'PassPriority', player: 'p1' }));
    must(g.submit({ t: 'ActivateAbility', player: 'p2', card: tim, abilityIndex: 0, targets: [{ kind: 'player', id: 'p1' }] }));
    const ping = top(g);
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    expect(g.state.priority.player).toBe('p1');
    put(g, 'p1', 'Mystic Snake');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const ask = g.state.priority.awaiting;
    if (ask?.kind !== 'chooseTargets' || ask.forKind !== 'trigger') throw new Error('no trigger prompt');
    expect(g.state.stack.find((o) => o.id === ask.stackId)?.kind, 'the trigger is on the stack as it is aimed').toBe('triggered');
    expect(refusal(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [onStack(ask.stackId)] })), 'an ability on the stack is an illegal target for itself').toBe('illegalTarget');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [onStack(ping)] }));
    expect(g.state.stack.find((o) => o.id === ask.stackId)?.targets).toEqual([onStack(ping)]);
    settle(g);
    hashHolds(g);
  });
});
