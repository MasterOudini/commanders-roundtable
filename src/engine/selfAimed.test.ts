// D373 - THE SELF-AIMED EFFECT, proven at the carrier. A quoted ability's body names its
// own source where a printed ability names its card:
//
//   All Slivers have "{2}: This creature gets +1/+0 until end of turn."   (Barbed Sliver)
//   All Slivers have "{2}: Regenerate this permanent."                     (Clot Sliver)
//   ... "Whenever this creature deals combat damage to a player, put a +1/+1 counter on it."
//
// Until now the vocabulary read a subject only as a TARGET clause: `pump` needed one,
// `regenerate` did not exist, and the bridge refused a self clause of every aimable kind
// because the executor resolved it for nothing (D344). What has to be true now:
//
//   · the parser reads the subject `~` for a pump, a counter, a bounce, an untap and a
//     regeneration - and NEVER reads "it", which on a spell is the previous target;
//   · the bridge spells a quoted body's "it" / lowercase "this creature" as `~`;
//   · `effects.ts` aims a self clause of a SELF_AIMED kind at the resolving object's
//     SOURCE - for a granted ability the RECIPIENT (CR 113.7a), never the provider;
//   · a source that left in response is a subject that is gone, said like a lost target;
//   · the regeneration shield is the one `destroy` and the SBA already spend;
//   · a granted TRIGGER's payload aims the same way, and the replay hash covers it all.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { BARBED_SLIVER, CLOT_SLIVER, DOOM_BLADE } from '../data/fixtures/engineCards';
import { derive } from './derive';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { grantedActivated, grantedTriggerRef } from './scripts/grants';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { CardScript } from './scripts/api';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const METALLIC = 'Metallic Sliver';
const CYCLOPS = 'Cyclops of One-Eyed Pass';

/** The generated shape (D367): one static installing the grant on every Sliver, one def resolving the body through the vocabulary. */
function sliverGrant(card: { readonly oracleId: string; readonly name: string }, quoted: string, body: string): { script: CardScript; ref: string } {
  const ref = `${card.oracleId}#g0`;
  const grant = grantedActivated(quoted, ref, card.name);
  const effects = vocabularyEffects(body, card.name);
  const targets = vocabularyTargets(body);
  const line = `All Slivers have "${quoted}"`;
  const script: CardScript = {
    oracleId: card.oracleId,
    name: card.name,
    statics: [
      {
        abilityId: 'grant-0',
        text: line,
        layer: 'ability',
        activeZones: ['battlefield'],
        appliesTo: (_ctx, _self, _candidate, chars) => chars.typeLine.subtypes.includes('Sliver'),
        modify: (chars, _ctx, self) => {
          chars.grantedActivated.push({ provider: self, ref: grant.ref, ability: grant.ability });
        },
      },
    ],
    activated: [
      {
        ref: grant.ref,
        text: line,
        granted: grant.ability,
        resolve: (ctx, _self, obj) => ctx.vocabulary(obj, effects, targets),
      },
    ],
  };
  return { script, ref };
}
const BARBED = sliverGrant(BARBED_SLIVER, '{2}: This creature gets +1/+0 until end of turn.', 'This creature gets +1/+0 until end of turn.');
const CLOT = sliverGrant(CLOT_SLIVER, '{2}: Regenerate this permanent.', 'Regenerate this permanent.');

// D368's shape for the triggered half: a grant whose payload names its recipient "it".
const COUNTER_ORACLE = 'test-self-aimed-trigger';
const COUNTER_LINE = 'Creatures you control have "At the beginning of your upkeep, put a +1/+1 counter on it."';
const COUNTER_REF = grantedTriggerRef(`${COUNTER_ORACLE}#gt0`, 'Testing Counters');
const COUNTER_EFFECTS = vocabularyEffects('put a +1/+1 counter on it.', 'Testing Counters');
const COUNTER_TARGETS = vocabularyTargets('put a +1/+1 counter on it.');
const COUNTERS: CardScript = {
  oracleId: COUNTER_ORACLE,
  name: 'Testing Counters',
  statics: [
    {
      abilityId: 'grant-0',
      text: COUNTER_LINE,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) =>
        chars.typeLine.types.includes('Creature') && ctx.query.controllerOf(candidate) === ctx.query.controllerOf(self),
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: COUNTER_REF });
      },
    },
  ],
  triggers: [
    {
      abilityId: 'gt0',
      text: COUNTER_LINE,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Testing Counters - a +1/+1 counter on it',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, COUNTER_EFFECTS, COUNTER_TARGETS),
    },
  ],
};

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function toMain3(g: Game): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}
const d = (g: Game, id: InstanceId) => derive(g.state, g.deps.oracle, g.deps.scripts, id);
function offersOn(g: Game, card: InstanceId) {
  return legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').filter((a) => a.t === 'ActivateAbility' && a.card === card);
}
function activate(g: Game, card: InstanceId, ref: string): void {
  const offer = offersOn(g, card).find((a) => a.t === 'ActivateAbility' && a.grantRef === ref);
  if (!offer || offer.t !== 'ActivateAbility') throw new Error(`${ref} is not offered on ${card}`);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card, abilityIndex: offer.abilityIndex, grantRef: ref, targets: [] }));
}
/** p1 kills its own permanent in response to whatever is on the stack (Doom Blade: destroy target nonblack creature). */
function doomBlade(g: Game, target: InstanceId): void {
  const blade = put(g, 'p1', DOOM_BLADE.name, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: blade, targets: [{ kind: 'card', id: target }] }));
}
function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const c = d(g, id);
  return [c.power, c.toughness];
}

function board(): { g: Game; metallic: InstanceId; barbed: InstanceId; clot: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[METALLIC, BARBED_SLIVER.name, CLOT_SLIVER.name, DOOM_BLADE.name, DOOM_BLADE.name, BEARS], [CYCLOPS]],
    scripts: createRegistry([BARBED.script, CLOT.script]),
  });
  holdEverywhere(g);
  const metallic = put(g, 'p1', METALLIC);
  const other = put(g, 'p2', CYCLOPS);
  const barbed = put(g, 'p1', BARBED_SLIVER.name);
  const clot = put(g, 'p1', CLOT_SLIVER.name);
  settle(g);
  toMain3(g);
  return { g, metallic, barbed, clot, other };
}

describe('D373 - the self subject in the vocabulary', () => {
  test('a pump, a counter, a bounce, an untap and a regeneration read `~` as a self clause', () => {
    const plain = parseEffects('~ gets +1/+0 until end of turn.', 'X', true);
    expect(plain.mode).toBe('auto');
    expect(plain.effects[0]).toMatchObject({ kind: 'pump', self: true, targetIndex: -1, power: 1, toughness: 0 });
    expect(parseEffects('This creature gets +2/+2 and gains trample until end of turn.', 'X', true).effects[0]).toMatchObject({ kind: 'pump', self: true, keywords: ['trample'] });
    expect(parseEffects('~ gains flying until end of turn.', 'X', true).effects[0]).toMatchObject({ kind: 'pump', self: true, keywords: ['flying'] });
    expect(parseEffects('Put a +1/+1 counter on this creature.', 'X', true).effects[0]).toMatchObject({ kind: 'putCounters', self: true, amount: 1, counterKind: '+1/+1' });
    expect(parseEffects("Return this permanent to its owner's hand.", 'X', true).effects[0]).toMatchObject({ kind: 'bounce', self: true });
    expect(parseEffects('Untap this creature.', 'X', true).effects[0]).toMatchObject({ kind: 'untap', self: true });
    expect(parseEffects('Regenerate this creature.', 'X', true).effects[0]).toMatchObject({ kind: 'regenerate', self: true, targetIndex: -1 });
    expect(parseEffects('Regenerate target creature.', 'X', true).effects[0]).toMatchObject({ kind: 'regenerate', self: false, targetIndex: 0 });
    const clue = parseEffects('Investigate.', 'X', true);
    expect(clue.mode).toBe('auto');
    expect(clue.effects[0]).toMatchObject({ kind: 'createToken', amount: 1, self: true });
    expect(clue.effects[0]?.token?.name).toBe('Clue');
  });

  test('"it" is NEVER a subject on the spell path: the previous target keeps its sentence', () => {
    expect(parseEffects('Target creature gets +2/+2 until end of turn. Untap it.', 'X', true).mode).not.toBe('auto');
    expect(parseEffects('Put a +1/+1 counter on it.', 'X', true).mode).not.toBe('auto');
    expect(parseEffects('It gains flying until end of turn.', 'X', true).mode).not.toBe('auto');
    // The mass pump is untouched by the new subject.
    expect(parseEffects('Creatures you control get +1/+1 until end of turn.', 'X', true).effects[0]?.kind).toBe('massPump');
  });

  test('the bridge spells a quoted body\'s recipient `~`, and no longer refuses the self-aimed kinds', () => {
    expect(vocabularyEffects('This creature gets +1/+0 until end of turn.', 'X')[0]).toMatchObject({ kind: 'pump', self: true });
    expect(vocabularyEffects('it gains double strike until end of turn.', 'X')[0]).toMatchObject({ kind: 'pump', self: true, keywords: ['doubleStrike'] });
    expect(vocabularyEffects('this creature gets +1/+1 until end of turn.', 'X')[0]).toMatchObject({ kind: 'pump', self: true });
    expect(vocabularyEffects('put a +1/+1 counter on it.', 'X')[0]).toMatchObject({ kind: 'putCounters', self: true });
    expect(vocabularyEffects('Regenerate this permanent.', 'X')[0]).toMatchObject({ kind: 'regenerate', self: true });
    expect(vocabularyEffects('Untap this creature.', 'X')[0]).toMatchObject({ kind: 'untap', self: true });
    // A damage clause keeps its TARGET; the lowercase subject and the leading "it" are the source.
    expect(vocabularyEffects('it deals 1 damage to any target.', 'X')[0]).toMatchObject({ kind: 'damage', self: false, amount: 1 });
    expect(vocabularyTargets('this creature deals 2 damage to any target.')).toHaveLength(1);
  });
});

describe('D373 - the self-aimed effect at the carrier', () => {
  test('the recipient is offered both grants; a creature outside the scope is offered nothing', () => {
    const { g, metallic } = board();
    const refs = offersOn(g, metallic).map((a) => (a.t === 'ActivateAbility' ? a.grantRef : undefined));
    expect(refs).toContain(BARBED.ref);
    expect(refs).toContain(CLOT.ref);
    const bears = put(g, 'p1', BEARS);
    settle(g);
    expect(offersOn(g, bears)).toHaveLength(0);
  });

  test('the pump lands on the RECIPIENT, not the provider, and ends at cleanup', () => {
    const { g, metallic, barbed } = board();
    expect(pt(g, metallic)).toEqual([1, 1]);
    activate(g, metallic, BARBED.ref);
    const top = g.state.stack[g.state.stack.length - 1];
    expect(top?.source).toBe(metallic);
    settle(g);
    expect(pt(g, metallic)).toEqual([2, 1]);
    expect(pt(g, barbed)).toEqual([2, 2]);
    expect(g.log.some((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === metallic)).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(pt(g, metallic)).toEqual([1, 1]);
  });

  test('the provider is in its own scope: it pumps ITSELF through its own grant', () => {
    const { g, barbed } = board();
    activate(g, barbed, BARBED.ref);
    settle(g);
    expect(pt(g, barbed)).toEqual([3, 2]);
  });

  test('a source that left in response is a subject that is gone - said, never silently skipped', () => {
    const { g, metallic } = board();
    activate(g, metallic, BARBED.ref);
    const before = g.log.length;
    doomBlade(g, metallic);
    settle(g);
    expect(g.state.cards[metallic]?.zone.kind).toBe('graveyard');
    const after = g.log.slice(before);
    expect(after.some((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === metallic)).toBe(false);
    expect(after.some((e) => e.body.t === 'Narrated' && /no legal target left/.test(e.body.text))).toBe(true);
  });

  test('the regeneration shield lands on the recipient and is the one `destroy` spends', () => {
    const { g, metallic } = board();
    activate(g, metallic, CLOT.ref);
    settle(g);
    expect(g.state.regenerationShields[metallic]).toBe(1);
    doomBlade(g, metallic);
    settle(g);
    expect(g.state.cards[metallic]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[metallic]?.tapped).toBe(true);
    expect(g.state.regenerationShields[metallic]).toBeUndefined();
    expect(g.log.some((e) => e.body.t === 'Regenerated' && e.body.card === metallic)).toBe(true);
  });

  test('a granted TRIGGER whose payload says "it" puts the counter on each recipient', () => {
    const g = startedGame({ players: 2, decks: [[BEARS, BEARS], [CYCLOPS]], scripts: createRegistry([COUNTERS]) });
    holdEverywhere(g);
    const bears = put(g, 'p1', BEARS);
    const provider = put(g, 'p1', BEARS);
    const inst = g.state.cards[provider];
    if (inst) (inst as { oracleId: string }).oracleId = COUNTER_ORACLE;
    put(g, 'p2', CYCLOPS);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.turn.step === 'upkeep' && s.turn.activePlayer === 'p1', 20_000);
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(g.state.cards[provider]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(pt(g, bears)).toEqual([3, 3]);
  });

  test('the log replays to the same hash', () => {
    const { g, metallic, barbed } = board();
    activate(g, metallic, BARBED.ref);
    settle(g);
    activate(g, barbed, CLOT.ref);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
