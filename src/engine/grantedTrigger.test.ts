// D368 — THE GRANTED TRIGGERED ABILITY, proven at the carrier rather than on a card.
//
// D367 gave the derived object a list of ACTIVATED abilities another permanent's
// static installed on it. This is the same carrier read by the other consumer: the
// trigger BUS. What has to be true, and is asserted here:
//
//   · the grant is DERIVED onto every permanent in the scope and no other;
//   · the trigger FIRES off the RECIPIENT — its `source` is the recipient, not the
//     provider, so "this creature" and "you" in the quoted body mean the recipient
//     and its controller (CR 113.7a);
//   · it fires once PER RECIPIENT, because two creatures in the scope have two
//     abilities and not one;
//   · it stops the moment the grant does — the provider leaving takes it away;
//   · a recipient that has lost its abilities does not fire it (CR 613 layer 6).
//
// ⚠️ The def lives on the PROVIDER's script and fires off the RECIPIENT, which is
// why the registry indexes it a second time BY REF: the per-oracleId index every
// printed trigger uses is keyed by the card the def belongs to, and the recipient
// is a different card entirely.
import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { grantedTriggerRef } from './scripts/grants';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const CYCLOPS = 'Cyclops of One-Eyed Pass';

// Its mirror: a static that takes every creature's abilities away (CR 613 layer 6).
const SILENCER_ORACLE = 'test-granted-silencer';
const SILENCER: CardScript = {
  oracleId: SILENCER_ORACLE,
  name: 'Testing Silence',
  statics: [
    {
      abilityId: 'silence-0',
      text: 'Creatures you control lose all abilities.',
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) =>
        chars.typeLine.types.includes('Creature') && ctx.query.controllerOf(candidate) === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.hasAbilities = false;
      },
    },
  ],
};

// Its opposite: the same quoted trigger, granted to NOBODY. A provider is not
// what it hands out (CR 113.3c), so this fires nothing at all.
const NARROW_ORACLE = 'test-granted-narrow';
const NARROW_REF = grantedTriggerRef(`${NARROW_ORACLE}#gt0`, 'Testing Narrow');
const NARROW: CardScript = {
  oracleId: NARROW_ORACLE,
  name: 'Testing Narrow',
  statics: [
    {
      abilityId: 'narrow-0',
      text: 'Nothing you control has "At the beginning of your upkeep, you gain 1 life."',
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: () => false,
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: NARROW_REF });
      },
    },
  ],
  triggers: [
    {
      abilityId: 'gt0',
      text: 'Nothing you control has "At the beginning of your upkeep, you gain 1 life."',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Testing Narrow - gain 1 life',
      resolve: (ctx, self) => {
        const who = ctx.query.controllerOf(self) ?? 'p1';
        const life = ctx.state.players[who]?.life ?? 0;
        return [{ t: 'LifeChanged', player: who, delta: 1, to: life + 1 }];
      },
    },
  ],
};

// A provider whose whole point is the grant: every creature its controller has
// gains "At the beginning of your upkeep, you gain 1 life."
const PROVIDER_ORACLE = 'test-granted-trigger';
const REF = grantedTriggerRef(`${PROVIDER_ORACLE}#gt0`, 'Testing Grant');

const GRANTER: CardScript = {
  oracleId: PROVIDER_ORACLE,
  name: 'Testing Grant',
  statics: [
    {
      abilityId: 'grant-0',
      text: 'Creatures you control have "At the beginning of your upkeep, you gain 1 life."',
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) =>
        chars.typeLine.types.includes('Creature') && ctx.query.controllerOf(candidate) === ctx.query.controllerOf(self),
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: REF });
      },
    },
  ],
  triggers: [
    {
      // ⚠️ `gt` is what makes the registry index this as GRANTED, and that index is
      // the bus's gate. Without the marker it would be indexed under the provider's
      // oracleId alone, where the recipient's walk can never reach it.
      abilityId: 'gt0',
      text: 'Creatures you control have "At the beginning of your upkeep, you gain 1 life."',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Testing Grant - gain 1 life',
      resolve: (ctx, self) => {
        const who = ctx.query.controllerOf(self) ?? 'p1';
        const life = ctx.state.players[who]?.life ?? 0;
        return [{ t: 'LifeChanged', player: who, delta: 1, to: life + 1 }];
      },
    },
  ],
};

/** Every creature p1 controls - the scope, counted off the board. */
function scopeSize(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return c?.controller === 'p1' && derive(g.state, g.deps.oracle, g.deps.scripts, id).typeLine.types.includes('Creature');
  }).length;
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p1's own upkeep, so the granted trigger's own condition holds. */
function toMyUpkeep(g: Game, turn: number): void {
  advanceUntil(g, (s) => s.turn.turnNumber >= turn && s.turn.step === 'upkeep' && s.turn.activePlayer === 'p1', 20_000);
  settle(g);
}

function game(extra: readonly string[] = []): Game {
  const g = startedGame({
    players: 2,
    decks: [[BEARS, BEARS, ...extra], [CYCLOPS]],
    scripts: createRegistry([GRANTER]),
  });
  holdEverywhere(g);
  return g;
}

/** The provider is a token-shaped stand-in: any permanent whose script is GRANTER. */
function provider(g: Game): InstanceId {
  const id = put(g, 'p1', BEARS);
  // Re-point the instance at the granter's oracleId, which is what the registry keys on.
  const inst = g.state.cards[id];
  if (inst) (inst as { oracleId: string }).oracleId = PROVIDER_ORACLE;
  return id;
}

describe('D368 - the granted triggered ability', () => {
  test('the grant is derived onto every permanent in the scope, and no other', () => {
    const g = game();
    const mine = put(g, 'p1', BEARS);
    const theirs = put(g, 'p2', CYCLOPS);
    const self = provider(g);
    settle(g);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, mine).grantedTriggered).toEqual([{ provider: self, ref: REF }]);
    // ⚠️ The scope is "creatures YOU control": an opponent's creature is outside it.
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, theirs).grantedTriggered).toHaveLength(0);
  });

  test('it FIRES off the recipient, and the recipient is the source', () => {
    const g = game();
    put(g, 'p1', BEARS);
    provider(g);
    settle(g);
    const life0 = g.state.players.p1?.life ?? 0;
    const recipients = scopeSize(g);
    expect(recipients).toBeGreaterThan(1);
    toMyUpkeep(g, 3);
    // ⚠️ ONE FIRING PER RECIPIENT: the provider is itself a creature in its own
    // scope, so the gain is the size of the scope and not one.
    expect(g.state.players.p1?.life ?? 0).toBe(life0 + recipients);
  });

  test('two creatures in the scope have TWO abilities, not one', () => {
    const g = game([BEARS]);
    put(g, 'p1', BEARS);
    put(g, 'p1', BEARS);
    provider(g);
    settle(g);
    const life0 = g.state.players.p1?.life ?? 0;
    const recipients = scopeSize(g);
    expect(recipients).toBeGreaterThan(2);
    toMyUpkeep(g, 3);
    expect(g.state.players.p1?.life ?? 0).toBe(life0 + recipients);
  });

  test('the grant stops the moment the provider leaves', () => {
    const g = game();
    put(g, 'p1', BEARS);
    const self = provider(g);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    const life0 = g.state.players.p1?.life ?? 0;
    toMyUpkeep(g, 3);
    expect(g.state.players.p1?.life ?? 0).toBe(life0);
  });

  test('a recipient that has lost its abilities does not fire it (CR 613 layer 6)', () => {
    const g = startedGame({
      players: 2,
      decks: [[BEARS, BEARS], [CYCLOPS]],
      scripts: createRegistry([GRANTER, SILENCER]),
    });
    holdEverywhere(g);
    put(g, 'p1', BEARS);
    const self = provider(g);
    settle(g);
    const life0 = g.state.players.p1?.life ?? 0;
    // The silencer clears `hasAbilities` on every creature its controller has -
    // including the provider, so the grant itself goes with them.
    const sil = put(g, 'p1', BEARS);
    const inst = g.state.cards[sil];
    if (inst) (inst as { oracleId: string }).oracleId = SILENCER_ORACLE;
    settle(g);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, self).hasAbilities).toBe(false);
    toMyUpkeep(g, 3);
    // ⚠️ Nothing fires: `finish()` clears `grantedTriggered` with every other
    // ability-shaped field, and the bus's own `hasAbilities` gate refuses the
    // recipient besides. Two independent reasons, and the rule needs both.
    expect(g.state.players.p1?.life ?? 0).toBe(life0);
  });

  test('the PROVIDER does not have what it hands out', () => {
    // ⚠️ The def lives on the provider's script, and the registry must index it
    // BY REF ALONE. Indexed under the provider's oracleId as well, it would fire
    // a second time off the provider itself - measured as `scope + 1` in both
    // tests above, and here as a life total that moves at all.
    const g = startedGame({
      players: 2,
      decks: [[BEARS, BEARS], [CYCLOPS]],
      scripts: createRegistry([NARROW]),
    });
    holdEverywhere(g);
    put(g, 'p1', BEARS);
    const self = put(g, 'p1', BEARS);
    const inst = g.state.cards[self];
    if (inst) (inst as { oracleId: string }).oracleId = NARROW_ORACLE;
    settle(g);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, self).grantedTriggered).toHaveLength(0);
    const life0 = g.state.players.p1?.life ?? 0;
    toMyUpkeep(g, 3);
    expect(g.state.players.p1?.life ?? 0).toBe(life0);
  });
});
