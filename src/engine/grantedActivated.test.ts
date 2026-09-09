// D367 - THE QUOTED GRANT, part 2: the runtime CARRIER. A permanent may HAVE an
// activated ability another permanent's static installed on it:
//
//   Enchanted creature has "{T}: This creature deals 1 damage to any target."
//
// Proven on a TESTING script over the real `Flight` fixture (an Aura, Enchant
// creature), whose static grants a quoted activation to whatever it enchants:
// the RECIPIENT is offered it beside its own abilities, pays its {T}, is the
// source of the damage, and the provider's def resolves it. The Cyclops the Aura
// is not on gets nothing; a stale intent after the Aura has left is refused; and
// - CR 113.7a - an ability already on the stack resolves though its provider has
// gone, because the def's `granted` copy is board-independent.
//
// ⚠️ The static's `text` is the card's REAL printed line so the module shape is
// the one a generated row takes; the accounting is not consulted by an engine
// test, which is what lets a testing script grant more than the print says.
import { describe, expect, test } from 'vitest';
import { FLIGHT } from '../data/fixtures/engineCards';
import { derive } from './derive';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { grantedActivated } from './scripts/grants';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { CardScript } from './scripts/api';
import type { InstanceId } from './types/ids';

const AURA = 'Flight';
const BEARS = 'Grizzly Bears';
const CYCLOPS = 'Cyclops of One-Eyed Pass';
const QUOTED = '{T}: This creature deals 1 damage to any target.';
const PAYLOAD = 'This creature deals 1 damage to any target.';
const REF = `${FLIGHT.oracleId}#g1`;

/** The shape a generated grant row takes: one static installing the ability, one def resolving it. */
function flightGranting(): CardScript {
  const grant = grantedActivated(QUOTED, REF, FLIGHT.name);
  const effects = vocabularyEffects(PAYLOAD, FLIGHT.name);
  const targets = vocabularyTargets(PAYLOAD);
  return {
    oracleId: FLIGHT.oracleId,
    name: FLIGHT.name,
    statics: [
      {
        abilityId: 'enchanted-grant-1',
        text: 'Enchanted creature has flying.',
        layer: 'ability',
        activeZones: ['battlefield'],
        appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
        modify: (chars, _ctx, self) => {
          chars.grantedActivated.push({ provider: self, ref: grant.ref, ability: grant.ability });
        },
      },
    ],
    activated: [
      {
        ref: grant.ref,
        text: 'Enchanted creature has flying.',
        granted: grant.ability,
        resolve: (ctx, _self, obj) => ctx.vocabulary(obj, effects, targets),
      },
    ],
  };
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; aura: InstanceId; host: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[AURA, BEARS], [CYCLOPS]],
    scripts: createRegistry([flightGranting()]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', BEARS);
  const other = put(g, 'p2', CYCLOPS);
  settle(g);
  const aura = put(g, 'p1', AURA, 'hand');
  settle(g);
  // p1's third-turn main phase: the host is past summoning sickness (CR 302.6).
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, aura, host, other };
}

function cast(g: Game, aura: InstanceId, target: InstanceId): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura, targets: [{ kind: 'card', id: target }] }));
  settle(g);
}

function offersOn(g: Game, card: InstanceId) {
  return legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').filter((a) => a.t === 'ActivateAbility' && a.card === card);
}

describe('D367 - the granted activated ability', () => {
  test('the enchanted creature HAS the ability: derived, and offered beside its own', () => {
    const { g, aura, host, other } = board();
    expect(offersOn(g, host)).toHaveLength(0);
    cast(g, aura, host);
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, host);
    expect(d.grantedActivated).toHaveLength(1);
    expect(d.grantedActivated[0]?.provider).toBe(aura);
    expect(d.grantedActivated[0]?.ref).toBe(REF);
    const offers = offersOn(g, host);
    expect(offers).toHaveLength(1);
    const offer = offers[0];
    expect(offer?.t === 'ActivateAbility' && offer.grantRef).toBe(REF);
    expect(offer?.t === 'ActivateAbility' && offer.requiresTap).toBe(true);
    expect(offer?.t === 'ActivateAbility' && offer.costText).toBe('{T}');
    // The scope is the attached creature: the Cyclops has nothing.
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, other).grantedActivated).toHaveLength(0);
  });

  test('activating it: the RECIPIENT taps, is the source, and the provider def resolves the damage', () => {
    const { g, aura, host } = board();
    cast(g, aura, host);
    const life0 = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: host, abilityIndex: 0, grantRef: REF, targets: [{ kind: 'player', id: 'p2' }] }));
    expect(g.state.cards[host]?.tapped).toBe(true);
    const top = g.state.stack[g.state.stack.length - 1];
    expect(top?.source).toBe(host);
    expect(top?.abilityRef).toBe(REF);
    settle(g);
    expect(g.state.players.p2?.life).toBe(life0 - 1);
    // The Aura itself is untouched: the recipient paid, not the provider.
    expect(g.state.cards[aura]?.tapped).toBe(false);
  });

  test('the same ability is not offered twice in a turn once it is tapped, and returns after the untap', () => {
    const { g, aura, host } = board();
    cast(g, aura, host);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: host, abilityIndex: 0, grantRef: REF, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(offersOn(g, host)).toHaveLength(0);
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    expect(g.state.cards[host]?.tapped).toBe(false);
    expect(offersOn(g, host)).toHaveLength(1);
  });

  test('a stale intent for a grant that has gone is refused, before any cost', () => {
    const { g, aura, host } = board();
    cast(g, aura, host);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: aura, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(offersOn(g, host)).toHaveLength(0);
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: host, abilityIndex: 0, grantRef: REF, targets: [{ kind: 'player', id: 'p2' }] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('notCastable');
    expect(g.state.cards[host]?.tapped).toBe(false);
  });

  test('CR 113.7a - an ability on the stack resolves though its provider has left', () => {
    const { g, aura, host } = board();
    cast(g, aura, host);
    const life0 = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: host, abilityIndex: 0, grantRef: REF, targets: [{ kind: 'player', id: 'p2' }] }));
    expect(g.state.stack).toHaveLength(1);
    // The Aura leaves in response (the holds keep priority with p1).
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: aura, to: { kind: 'graveyard', player: 'p1' } }));
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, host).grantedActivated).toHaveLength(0);
    settle(g);
    expect(g.state.players.p2?.life).toBe(life0 - 1);
  });

  test("the grant's parser refuses what the engine cannot charge, and a ref that is not a grant", () => {
    // ⚠️ The parser's unit is the LINE, so two abilities are two lines - one line holding two
    // "cost: effect" sentences is ONE ability whose effect text carries the second.
    expect(() => grantedActivated('{T}: Draw a card.\n{1}: Draw a card.', REF, FLIGHT.name)).toThrow(/exactly one/);
    expect(() => grantedActivated('Tap two untapped Slivers you share a name with: Draw a card.', REF, FLIGHT.name)).toThrow(/not one the engine can charge/);
    expect(() => grantedActivated(QUOTED, `${FLIGHT.oracleId}#a1`, FLIGHT.name)).toThrow(/#g/);
    // A quoted MANA ability parses as an activation whose effect the vocabulary has no rule
    // for - refused at the vocabulary, never half-run (CR 605 is a later seam).
    const mana = grantedActivated('{T}: Add {G}.', REF, FLIGHT.name);
    expect(mana.ability.isManaAbility).toBe(false);
    expect(() => vocabularyEffects(mana.ability.effectText, FLIGHT.name)).toThrow();
  });

  test('replays to the same hash', () => {
    const { g, aura, host } = board();
    cast(g, aura, host);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: host, abilityIndex: 0, grantRef: REF, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
