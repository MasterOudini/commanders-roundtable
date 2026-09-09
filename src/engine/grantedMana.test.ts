// D372 - THE GRANTED MANA ABILITY, proven at the carrier. A permanent may HAVE a mana
// ability another permanent's static installed on it:
//
//   Creatures you control have "{T}: Add one mana of any color."   (Cryptolith Rite)
//   All Slivers have "Sacrifice this permanent: Add {B}{B}."        (Basal Sliver)
//
// A mana ability never uses the stack (CR 605), so the carrier is not a def: the
// static pushes a ManaProduction - read by the INGEST's own parser - onto the
// recipient's derived `producesMana`, and everything downstream already reads that
// list: the offer, the tap, the payment solver, the plan. What has to be true:
//
//   · the recipient HAS the production, its printed ones keep their indices;
//   · it is OFFERED only past summoning sickness (a creature's {T}, CR 302.6);
//   · tapping it charges the RECIPIENT and adds the mana;
//   · the solver FUNDS a spell from it - the real source, never the hand tool (D364);
//   · a sacrifice price is the recipient's own (CR 113.7a) and is never auto-tapped;
//   · the grant stops when the provider leaves, and a silenced recipient has none.
import { describe, expect, test } from 'vitest';
import { BASAL_SLIVER, CRYPTOLITH_RITE } from '../data/fixtures/engineCards';
import { derive } from './derive';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { manaSourcesOf } from './mana';
import { grantedMana, pushGrantedMana } from './scripts/grants';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { CardScript } from './scripts/api';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const ELVES = 'Llanowar Elves';
const METALLIC = 'Metallic Sliver';
const CYCLOPS = 'Cyclops of One-Eyed Pass';

const RITE_LINE = 'Creatures you control have "{T}: Add one mana of any color."';
const RITE_GRANT = grantedMana('{T}: Add one mana of any color.', CRYPTOLITH_RITE.name);
const RITE: CardScript = {
  oracleId: CRYPTOLITH_RITE.oracleId,
  name: CRYPTOLITH_RITE.name,
  statics: [
    {
      abilityId: 'grant-0',
      text: RITE_LINE,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) =>
        chars.typeLine.types.includes('Creature') && ctx.query.controllerOf(candidate) === ctx.query.controllerOf(self),
      modify: (chars) => {
        pushGrantedMana(chars, RITE_GRANT);
      },
    },
  ],
};

const BASAL_LINE = 'All Slivers have "Sacrifice this permanent: Add {B}{B}."';
const BASAL_GRANT = grantedMana('Sacrifice this permanent: Add {B}{B}.', BASAL_SLIVER.name);
const BASAL: CardScript = {
  oracleId: BASAL_SLIVER.oracleId,
  name: BASAL_SLIVER.name,
  statics: [
    {
      abilityId: 'grant-0',
      text: BASAL_LINE,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, _self, _candidate, chars) => chars.typeLine.subtypes.includes('Sliver'),
      modify: (chars) => {
        pushGrantedMana(chars, BASAL_GRANT);
      },
    },
  ],
};

// Its mirror (D368's): a static that takes every creature's abilities away (CR 613 layer 6).
const SILENCER_ORACLE = 'test-granted-mana-silencer';
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

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function toMain3(g: Game): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}
function poolTotal(g: Game, p: 'p1' | 'p2'): number {
  const pool = g.state.players[p]?.pool;
  return pool ? pool.W + pool.U + pool.B + pool.R + pool.G + pool.C : -1;
}
function tapsOn(g: Game, card: InstanceId) {
  return legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').filter((a) => a.t === 'TapForMana' && a.card === card);
}

function board(extra: readonly CardScript[] = []): { g: Game; bears: InstanceId; rite: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BEARS, CRYPTOLITH_RITE.name, BASAL_SLIVER.name, METALLIC, ELVES, ELVES], [CYCLOPS]],
    scripts: createRegistry([RITE, BASAL, ...extra]),
  });
  holdEverywhere(g);
  const bears = put(g, 'p1', BEARS);
  const other = put(g, 'p2', CYCLOPS);
  const rite = put(g, 'p1', CRYPTOLITH_RITE.name);
  settle(g);
  return { g, bears, rite, other };
}
const d = (g: Game, id: InstanceId) => derive(g.state, g.deps.oracle, g.deps.scripts, id);

describe('D372 - the granted mana ability', () => {
  test('the recipient HAS the production; the provider and the opponent do not', () => {
    const { g, bears, rite, other } = board();
    const mine = d(g, bears).producesMana;
    expect(mine).toHaveLength(1);
    expect(mine[0]?.abilityIndex).toBe(0);
    expect(mine[0]?.anyColor).toEqual({ scope: 'all', amount: 1 });
    expect(mine[0]?.requiresTap).toBe(true);
    expect(d(g, other).producesMana).toHaveLength(0);
    // The Rite is an enchantment: outside its own scope.
    expect(d(g, rite).producesMana).toHaveLength(0);
  });

  test('a creature that PRINTS a mana ability keeps its index and takes the grant as the next', () => {
    const { g } = board();
    const elf = put(g, 'p1', ELVES);
    settle(g);
    const list = d(g, elf).producesMana;
    expect(list).toHaveLength(2);
    expect(list[0]?.abilityIndex).toBe(0);
    expect(list[0]?.anyColor).toBeNull();
    expect(list[1]?.abilityIndex).toBe(1);
    expect(list[1]?.anyColor?.scope).toBe('all');
  });

  test('offered only past summoning sickness (CR 302.6), then tapped: the RECIPIENT taps and the mana lands', () => {
    const { g, bears } = board();
    expect(tapsOn(g, bears)).toHaveLength(0);
    toMain3(g);
    const offers = tapsOn(g, bears);
    expect(offers).toHaveLength(1);
    const offer = offers[0];
    expect(offer?.t === 'TapForMana' && offer.abilityIndex).toBe(0);
    expect(offer?.t === 'TapForMana' && offer.outputs.length).toBeGreaterThan(0);
    const before = poolTotal(g, 'p1');
    must(g.submit({ t: 'TapForMana', player: 'p1', card: bears, abilityIndex: 0, outputChoice: 0 }));
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(poolTotal(g, 'p1')).toBe(before + 1);
    expect(tapsOn(g, bears)).toHaveLength(0);
  });

  test('the SOLVER funds a spell from it - the real source, never the hand tool (D364)', () => {
    const { g, bears } = board();
    toMain3(g);
    // No land on the battlefield: the granted Bears is the only source p1 has.
    expect(manaSourcesOf(g.state, g.deps.oracle, g.deps.scripts, 'p1', {}).map((s) => s.card)).toEqual([bears]);
    const elf = put(g, 'p1', ELVES, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: elf, targets: [] }));
    settle(g);
    expect(g.state.cards[elf]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('the grant stops when the provider leaves, and a stale tap is refused', () => {
    const { g, bears, rite } = board();
    toMain3(g);
    expect(tapsOn(g, bears)).toHaveLength(1);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: rite, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(d(g, bears).producesMana).toHaveLength(0);
    expect(tapsOn(g, bears)).toHaveLength(0);
    const r = g.submit({ t: 'TapForMana', player: 'p1', card: bears, abilityIndex: 0, outputChoice: 0 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('notAManaAbility');
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test("a sacrifice price is the RECIPIENT's own (CR 113.7a), and never an auto-tap source", () => {
    const { g } = board();
    const basal = put(g, 'p1', BASAL_SLIVER.name);
    const metallic = put(g, 'p1', METALLIC);
    settle(g);
    toMain3(g);
    // ⚠️ TWO grants on one Sliver: the Rite (a creature of p1's) installed the any-colour tap
    // first, Basal the sacrifice - in timestamp order, each with its own index.
    const list = d(g, metallic).producesMana;
    expect(list).toHaveLength(2);
    const sac = list.find((p) => p.extraCost?.sacrificeSelf === true);
    expect(sac?.requiresTap).toBe(false);
    expect(sac?.abilityIndex).toBe(1);
    // Basal Sliver is a Sliver: inside its own scope (and a creature: inside the Rite's).
    expect(d(g, basal).producesMana).toHaveLength(2);
    // ⚠️ Costly: the solver never taps the SACRIFICE by itself (D325) - the Rite's tap it may.
    const auto = manaSourcesOf(g.state, g.deps.oracle, g.deps.scripts, 'p1', {}).filter((s) => s.card === metallic);
    expect(auto.map((s) => s.abilityIndex)).toEqual([0]);
    expect(tapsOn(g, metallic)).toHaveLength(2);
    const before = poolTotal(g, 'p1');
    must(g.submit({ t: 'TapForMana', player: 'p1', card: metallic, abilityIndex: 1, outputChoice: 0 }));
    expect(g.state.cards[metallic]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.pool.B).toBe(2);
    expect(poolTotal(g, 'p1')).toBe(before + 2);
    // The provider paid nothing: the price was the recipient's.
    expect(g.state.cards[basal]?.zone.kind).toBe('battlefield');
  });

  test('a recipient that has lost its abilities has no granted mana either (CR 613 layer 6)', () => {
    const { g, bears } = board([SILENCER]);
    toMain3(g);
    expect(d(g, bears).producesMana).toHaveLength(1);
    const sil = put(g, 'p1', BEARS);
    const inst = g.state.cards[sil];
    if (inst) (inst as { oracleId: string }).oracleId = SILENCER_ORACLE;
    settle(g);
    expect(d(g, bears).hasAbilities).toBe(false);
    expect(d(g, bears).producesMana).toHaveLength(0);
    expect(tapsOn(g, bears)).toHaveLength(0);
  });

  test("the reader refuses what the engine would half-run", () => {
    expect(() => grantedMana('{T}: Add five mana in any combination of colors. Spend this mana only to cast spells.', 'x')).toThrow('exactly one');
    expect(() => grantedMana('{T}: Add {G}. Spend this mana only to cast creature spells.', 'x')).toThrow('conditional');
    expect(() => grantedMana('{T}: Draw a card.', 'x')).toThrow('exactly one');
    expect(() => grantedMana('{T}: Add {G}.' + String.fromCharCode(10) + '{T}: Add {U}.', 'x')).toThrow('exactly one');
    expect(grantedMana('{T}, Pay 1 life: Add one mana of any color.', 'x').extraCost?.life).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, bears } = board();
    toMain3(g);
    must(g.submit({ t: 'TapForMana', player: 'p1', card: bears, abilityIndex: 0, outputChoice: 0 }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
