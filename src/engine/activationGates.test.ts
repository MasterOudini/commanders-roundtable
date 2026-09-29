// THE HOST RE-CHECKS WHAT THE OFFER READ. `legal.ts` offers no activated ability of a battlefield permanent with NO
// ABILITIES (face down - CR 708.2 - or under a "loses all abilities" effect - CR 613 layer 6) or of a PHASED-OUT one
// (CR 702.26b - treated as though it does not exist), and no summoning-sick creature's {T} ability (CR 302.6).
// `activateAbility` re-checked none of the three, so a hand-built intent - a guest's, in multiplayer, where the host
// validates every intent through that handler - activated a face-down Suture Spirit's printed regeneration (the log and
// the stack label naming the hidden card, CR 708.5), a Humility'd one's, a face-down Jace Beleren's +2, a phased-out
// source's, and a Prodigal Sorcerer's ping on the turn it arrived. What is proven here: each is refused with nothing
// emitted and no seat reading the hidden name; the same intent is accepted once the reason is gone (turned face up,
// Humility gone, phased in, a turn later - and a hasty creature at once); a granted ability of a silenced recipient and
// the mana ability of a face-down or silenced creature were refused already (the derived `grantedActivated` and
// `producesMana` are emptied with the abilities) and stay so; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { FLIGHT, LLANOWAR_ELVES } from '../data/fixtures/engineCards';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { project } from './project';
import { grantedActivated } from './scripts/grants';
import { createRegistry } from './scripts/registryCore';
import { CUNNING_SPARKMAGE_SCRIPT } from './scripts/cards/cunningSparkmage';
import { JACE_BELEREN_SCRIPT } from './scripts/cards/jaceBeleren';
import { PRODIGAL_SORCERER_SCRIPT } from './scripts/cards/prodigalSorcerer';
import { SUTURE_SPIRIT_SCRIPT } from './scripts/cards/sutureSpirit';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { HUMILITY_SCRIPT } from './testing/cardScripts';
import { advanceUntil, findAnywhere, holdEverywhere, must, ORACLE, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { Intent } from './types/intents';
import type { InstanceId, PlayerId } from './types/ids';

const SPIRIT = 'Suture Spirit';
const JACE = 'Jace Beleren';
const ELVES = 'Llanowar Elves';
const BEARS = 'Grizzly Bears';

/** A test carrier (phasing.test.ts's): the Elves' enter trigger phases out a target permanent. */
const PHASE_OUT = vocabularyEffects('Target permanent phases out.', LLANOWAR_ELVES.name);
const PHASE_OUT_T = vocabularyTargets('Target permanent phases out.');
const PHASER: CardScript = {
  oracleId: LLANOWAR_ELVES.oracleId,
  name: LLANOWAR_ELVES.name,
  triggers: [
    {
      abilityId: 'etb-phase',
      text: 'When this creature enters, target permanent phases out.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      targets: PHASE_OUT_T,
      label: () => 'Llanowar Elves - target permanent phases out',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, PHASE_OUT, PHASE_OUT_T),
    },
  ],
};

/** A test carrier (grantedActivated.test.ts's): Flight grants the creature it enchants a quoted {T} ping (D367). */
const GRANT_REF = `${FLIGHT.oracleId}#g1`;
const PING = 'This creature deals 1 damage to any target.';
const GRANT = grantedActivated(`{T}: ${PING}`, GRANT_REF, FLIGHT.name);
const FLIGHT_GRANTING: CardScript = {
  oracleId: FLIGHT.oracleId,
  name: FLIGHT.name,
  statics: [
    {
      abilityId: 'enchanted-grant-1',
      text: 'Enchanted creature has flying.',
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT.ref, ability: GRANT.ability });
      },
    },
  ],
  activated: [
    {
      ref: GRANT.ref,
      text: 'Enchanted creature has flying.',
      granted: GRANT.ability,
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects(PING, FLIGHT.name), vocabularyTargets(PING)),
    },
  ],
};

function game(p1: readonly string[], scripts: readonly CardScript[]): Game {
  const g = startedGame({ players: 2, decks: [p1, []], scripts: createRegistry(scripts), options: { maxHandSize: null } });
  holdEverywhere(g);
  return g;
}
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
/** p1's main phase of `turn` (1, 3, 5 ... are p1's), the stack empty and nothing asked. */
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const view = (g: Game, seat: PlayerId) => project(g.state, ORACLE, g.deps.scripts, seat);
const offers = (g: Game, card: InstanceId) => legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').filter((a) => (a.t === 'ActivateAbility' || a.t === 'TapForMana') && a.card === card);
const white = (g: Game) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
const handSizes = (g: Game) => [(g.state.zones.hand['p1'] ?? []).length, (g.state.zones.hand['p2'] ?? []).length];
/** A card onto p1's battlefield face down, the way a morph arrives. */
function faceDownOnto(g: Game, name: string): InstanceId {
  const card = findAnywhere(g, 'p1', name);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'battlefield', player: 'p1' }, faceDown: true }));
  expect(g.state.cards[card]?.faceDown).toBe(true);
  return card;
}
/** The host refuses `intent` for `reason` and emits NOTHING: the log, the hash and the narration stand still. */
function refused(g: Game, intent: Intent, reason: string): string {
  const log0 = g.log.length;
  const hash0 = g.hash();
  const lines0 = g.state.narration.length;
  const result = g.submit(intent);
  expect(result.ok, `${intent.t} was accepted`).toBe(false);
  expect([g.log.length, g.hash(), g.state.narration.length], 'nothing emitted - no line, so none names the card').toEqual([log0, hash0, lines0]);
  expect(g.state.pendingCast, 'no activation begun').toBeNull();
  if (result.ok) return '';
  expect(result.reason, result.message).toBe(reason);
  return result.message;
}

describe('the host re-checks the battlefield offer: no abilities, phased out, summoning sick', () => {
  test('a face-down permanent has no abilities to activate (CR 708.2): refused, and no seat reads its name; face up, it has them', () => {
    const g = game([SPIRIT], [SUTURE_SPIRIT_SCRIPT]);
    main(g, 1);
    const spirit = faceDownOnto(g, SPIRIT);
    settle(g);
    white(g);
    expect(offers(g, spirit), 'the offer never had it').toEqual([]);
    const regen = { t: 'ActivateAbility', player: 'p1', card: spirit, abilityIndex: 0 } as const;
    expect(refused(g, regen, 'notCastable'), 'the refusal names no hidden card').not.toContain(SPIRIT);
    // The one-intent form (targets named inline, D161) is refused the same way, before any target is read.
    refused(g, { ...regen, targets: [{ kind: 'card', id: spirit }] }, 'notCastable');
    expect([g.state.players['p1']?.pool.W, g.state.regenerationShields[spirit] ?? 0], 'no mana spent, no shield').toEqual([3, 0]);
    // No line, and no stack object to carry a label: the opponent still sees a nameless 2/2. (The face-down MOVE's own
    // line is manual.ts's, fixed apart on fix/facedown-narration - not this handler's.)
    expect([view(g, 'p2').cards[spirit]?.card, view(g, 'p2').stack], "the opponent's view").toEqual([null, []]);
    // Turned face up it has its ability again: offered, and the same intent accepted - the shield lands.
    must(g.submit({ t: 'ManualSetFaceDown', player: 'p1', card: spirit, faceDown: false }));
    expect(offers(g, spirit)).toHaveLength(1);
    must(g.submit({ ...regen, targets: [{ kind: 'card', id: spirit }] }));
    settle(g);
    expect(g.state.regenerationShields[spirit]).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a permanent that has lost all its abilities (Humility) has none to activate (CR 613 layer 6); Humility gone, it has them', () => {
    const g = game([SPIRIT, 'Humility'], [SUTURE_SPIRIT_SCRIPT, HUMILITY_SCRIPT]);
    main(g, 1);
    const spirit = put(g, 'p1', SPIRIT);
    settle(g);
    expect(offers(g, spirit), 'offered before Humility').toHaveLength(1);
    const humility = put(g, 'p1', 'Humility');
    settle(g);
    white(g);
    expect(offers(g, spirit)).toEqual([]);
    const regen = { t: 'ActivateAbility', player: 'p1', card: spirit, abilityIndex: 0, targets: [{ kind: 'card', id: spirit }] } as const;
    expect(refused(g, regen, 'notCastable')).toBe(`${SPIRIT} has lost its abilities - it has none to activate.`);
    expect([g.state.players['p1']?.pool.W, g.state.regenerationShields[spirit] ?? 0], 'no mana spent, no shield').toEqual([3, 0]);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: humility, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(offers(g, spirit)).toHaveLength(1);
    must(g.submit(regen));
    settle(g);
    expect(g.state.regenerationShields[spirit]).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a face-down planeswalker card has no loyalty ability either (CR 708.2): no counter, no draw, no name', () => {
    const g = game([JACE], [JACE_BELEREN_SCRIPT]);
    main(g, 1);
    const jace = faceDownOnto(g, JACE);
    settle(g);
    const hands = handSizes(g);
    expect(offers(g, jace)).toEqual([]);
    expect(refused(g, { t: 'ActivateAbility', player: 'p1', card: jace, abilityIndex: 0 }, 'notCastable')).not.toContain(JACE);
    settle(g);
    expect([g.state.cards[jace]?.counters['loyalty'] ?? 0, ...handSizes(g)], 'no loyalty counter, nobody drew').toEqual([0, ...hands]);
    expect([view(g, 'p2').cards[jace]?.card, view(g, 'p2').stack], "the opponent's view").toEqual([null, []]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a granted ability goes with the abilities (D367): a silenced recipient is refused it, as it always was', () => {
    const g = game([BEARS, FLIGHT.name, 'Humility'], [FLIGHT_GRANTING, HUMILITY_SCRIPT]);
    main(g, 1);
    const bears = put(g, 'p1', BEARS);
    const flight = put(g, 'p1', FLIGHT.name, 'hand');
    settle(g);
    main(g, 3);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: flight, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(offers(g, bears).map((a) => a.t === 'ActivateAbility' && a.grantRef), 'the enchanted Bears has the grant').toEqual([GRANT_REF]);
    put(g, 'p1', 'Humility');
    settle(g);
    expect(offers(g, bears)).toEqual([]);
    refused(g, { t: 'ActivateAbility', player: 'p1', card: bears, abilityIndex: 0, grantRef: GRANT_REF, targets: [{ kind: 'player', id: 'p2' }] }, 'notCastable');
    expect([g.state.cards[bears]?.tapped, g.state.players['p2']?.life], 'not tapped, no damage').toEqual([false, 40]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a mana ability goes with them too: a face-down or silenced Llanowar Elves makes no mana, as it never did', () => {
    const g = game([ELVES, ELVES, 'Humility'], [HUMILITY_SCRIPT]);
    main(g, 1);
    const hidden = faceDownOnto(g, ELVES);
    const elves = put(g, 'p1', ELVES);
    settle(g);
    main(g, 3);
    const tap = (card: InstanceId) => ({ t: 'TapForMana', player: 'p1', card, abilityIndex: 0, outputChoice: 0 }) as const;
    expect(offers(g, hidden)).toEqual([]);
    refused(g, tap(hidden), 'notAManaAbility');
    expect(offers(g, elves).map((a) => a.t), 'the face-up Elves taps').toEqual(['TapForMana']);
    const humility = put(g, 'p1', 'Humility');
    settle(g);
    expect(offers(g, elves)).toEqual([]);
    refused(g, tap(elves), 'notAManaAbility');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: humility, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit(tap(elves)));
    expect(g.state.players['p1']?.pool.G).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a phased-out permanent is treated as though it does not exist (CR 702.26b): refused; phased in, it activates', () => {
    const g = game([SPIRIT, ELVES], [SUTURE_SPIRIT_SCRIPT, PHASER]);
    main(g, 1);
    const spirit = put(g, 'p1', SPIRIT);
    settle(g);
    put(g, 'p1', ELVES);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: spirit }] }));
    settle(g);
    expect(g.state.cards[spirit]?.phasedOut).toBe(true);
    white(g);
    expect(offers(g, spirit)).toEqual([]);
    const regen = { t: 'ActivateAbility', player: 'p1', card: spirit, abilityIndex: 0 } as const;
    expect(refused(g, regen, 'wrongZone')).toBe(`${SPIRIT} is phased out - its abilities can't be activated until it phases in.`);
    expect(g.state.players['p1']?.pool.W, 'no mana spent').toBe(3);
    // It phases in during p1's next untap step (CR 502.1).
    main(g, 3);
    expect(g.state.cards[spirit]?.phasedOut).toBe(false);
    white(g);
    expect(offers(g, spirit)).toHaveLength(1);
    must(g.submit({ ...regen, targets: [{ kind: 'card', id: spirit }] }));
    settle(g);
    expect(g.state.regenerationShields[spirit]).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("a summoning-sick creature's {T} ability is refused (CR 302.6); with haste at once, without it a turn later", () => {
    const g = game(['Prodigal Sorcerer', 'Cunning Sparkmage'], [PRODIGAL_SORCERER_SCRIPT, CUNNING_SPARKMAGE_SCRIPT]);
    main(g, 1);
    const sorcerer = put(g, 'p1', 'Prodigal Sorcerer');
    const sparkmage = put(g, 'p1', 'Cunning Sparkmage');
    settle(g);
    const ping = (card: InstanceId) => ({ t: 'ActivateAbility', player: 'p1', card, abilityIndex: 0, targets: [{ kind: 'player', id: 'p2' }] }) as const;
    expect(offers(g, sorcerer)).toEqual([]);
    expect(refused(g, ping(sorcerer), 'timingRestriction')).toBe("Prodigal Sorcerer has summoning sickness - its {T} ability can be activated from your next turn.");
    expect([g.state.cards[sorcerer]?.tapped, g.state.players['p2']?.life], 'not tapped, no damage').toEqual([false, 40]);
    // The same turn, a creature with haste (the offer's `readyToTap` - CR 302.6's exception).
    expect(offers(g, sparkmage)).toHaveLength(1);
    must(g.submit(ping(sparkmage)));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    // A turn later, under p1's control since the turn began.
    main(g, 3);
    expect(offers(g, sorcerer)).toHaveLength(1);
    must(g.submit(ping(sorcerer)));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
