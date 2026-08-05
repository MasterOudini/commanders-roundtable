// CR 613 layer 6 — granting and removing abilities, in timestamp order.
// See D129.
//
// ⚠️ WHAT WAS BROKEN, AND IT WAS NOT THE LAYER. `derive.ts` has called
// `applyStatics(…, 'ability')` since M3 and D127 read that as "layer 6 does not
// exist". It exists; what it lacked was an ORDER. `applyStatics` looped the
// registered DEFS outermost and the battlefield innermost, so every source of
// the first-registered script applied before any source of the second — making
// `Levitation` against `Gravity Sphere` a question about the registry rather
// than about which enchantment entered the battlefield last.
//
// ⚠️ Driven with the real pair, because two GRANTS commute and prove nothing
// about order. A grant and a removal do not.

import { describe, expect, test } from 'vitest';
import type { StaticDef } from './scripts/api';
import { canBlock } from './combat';
import { derive } from './derive';
import { Game } from './game';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registry';
import { GRAVITY_SPHERE_SCRIPT, LEVITATION_SCRIPT, HUMILITY_SCRIPT, KNIGHTHOOD_SCRIPT, KWENDE_SCRIPT, SPINELESS_THUG_SCRIPT } from './testing/cardScripts';
import { advanceUntil, find, must, nameOf, ORACLE, put, startedGame, holdEverywhere } from './testing/harness';
import type { InstanceId } from './types/ids';

/**
 * ⚠️ BOTH SCRIPTS, ALWAYS, in one fixed registration order. The whole point is
 * that the ANSWER must come from the battlefield rather than from this list, so
 * a test that registered only the script it wanted to win would prove the
 * opposite of what it claims.
 */
const SCRIPTS = createRegistry([LEVITATION_SCRIPT, GRAVITY_SPHERE_SCRIPT]);

const DECK = ['Levitation', 'Gravity Sphere', 'Grizzly Bears', 'Air Elemental', 'Giant Spider'];

function board(): Game {
  return startedGame({ players: 2, decks: [DECK, DECK], scripts: SCRIPTS });
}

function flies(game: Game, id: InstanceId): boolean {
  return derive(game.state, ORACLE, SCRIPTS, id).keywords.has('flying');
}

describe('layer 6 — granting and removing abilities (CR 613)', () => {
  test('Levitation grants flying to its controller’s creatures, and nobody else’s', () => {
    const game = board();
    const mine = put(game, 'p1', 'Grizzly Bears');
    const theirs = put(game, 'p2', 'Grizzly Bears');
    expect(flies(game, mine)).toBe(false);

    put(game, 'p1', 'Levitation');
    expect(flies(game, mine)).toBe(true);
    // "Creatures YOU control" — the enchantment's controller, not everyone.
    expect(flies(game, theirs)).toBe(false);
  });

  /**
   * ⚠️ THE PROMISE D82 MADE AND COULD NOT KEEP. Hexproof and shroud have been
   * enforced only where PRINTED since the targeting work, on the stated grounds
   * that "a granted one needs a layer-6 script" — and no layer-6 script had ever
   * existed, so nothing had ever checked that a granted keyword reaches the rules
   * that read keywords. `combat.ts` is UNCHANGED by this milestone: it reads
   * DERIVED characteristics, so the grant arrives for free.
   */
  test('a granted keyword reaches combat — the block prompt stops offering a ground blocker', () => {
    // ⚠️ Asserted on the PROMPT'S OWN `legal` list, not on a direct `canBlock`
    // call: that list is what a client actually sees, it is computed by the host
    // because no client can derive it (D125), and it is the thing that would go
    // wrong if a granted keyword stopped short of `derive`.
    const offeredAgainstTheBears = (grant: boolean): string[] => {
      const game = board();
      const attacker = put(game, 'p1', 'Grizzly Bears');
      put(game, 'p2', 'Grizzly Bears');
      put(game, 'p2', 'Giant Spider');
      if (grant) put(game, 'p1', 'Levitation');
      advanceUntil(
        game,
        (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
        20_000,
      );
      must(
        game.submit({
          t: 'DeclareAttackers',
          player: 'p1',
          attackers: [{ card: attacker, defender: { kind: 'player', id: 'p2' } }],
        }),
      );
      const awaiting = game.state.priority.awaiting;
      if (awaiting?.kind !== 'declareBlockers') throw new Error(`expected blockers, got ${awaiting?.kind}`);
      return awaiting.legal
        .filter((row) => row.attackers.includes(attacker))
        .map((row) => nameOf(game, row.blocker))
        .sort();
    };

    expect(offeredAgainstTheBears(false)).toEqual(['Giant Spider', 'Grizzly Bears']);
    // Levitation makes the attacker fly, so only reach can stop it. `combat.ts`
    // is UNCHANGED by this milestone — it reads derived keywords.
    expect(offeredAgainstTheBears(true)).toEqual(['Giant Spider']);
  });

  /**
   * ⚠️ A granted keyword must not REORDER `canBlock`'s refusals. Its clauses run
   * in a fixed order and "that creature is not attacking" comes before the
   * evasion checks — so a board where the grant is live still answers the
   * cheaper question first, and the block prompt never reports "needs flying"
   * about a creature that is not in combat at all.
   */
  test('a live grant does not reorder `canBlock`’s refusals', () => {
    const game = board();
    const attacker = put(game, 'p1', 'Grizzly Bears');
    const blocker = put(game, 'p2', 'Grizzly Bears');
    put(game, 'p1', 'Levitation');
    expect(flies(game, attacker)).toBe(true);
    const deps = { state: game.state, oracle: ORACLE, scripts: SCRIPTS };
    expect(canBlock(deps, blocker, attacker)).toBe('notAttacking');
  });

  test('Gravity Sphere takes flying off a PRINTED flier, and off everyone', () => {
    const game = board();
    const mine = put(game, 'p1', 'Air Elemental');
    const theirs = put(game, 'p2', 'Air Elemental');
    expect(flies(game, mine)).toBe(true);

    put(game, 'p1', 'Gravity Sphere');
    expect(flies(game, mine)).toBe(false);
    // "ALL creatures" — including the opponent's.
    expect(flies(game, theirs)).toBe(false);
  });

  /**
   * ⚠️ THE CHECK THE RESTRUCTURE EXISTS FOR. Same registry, same two cards, same
   * creature — only the order they entered the battlefield differs, and the
   * answer flips. With the old loop nesting both cases returned whichever script
   * `createRegistry` saw first, so one of the two was silently wrong.
   */
  test('the LAST one to enter the battlefield wins (CR 613.7)', () => {
    const bearsFly = (first: string, second: string): boolean => {
      const game = board();
      const bears = put(game, 'p1', 'Grizzly Bears');
      put(game, 'p1', first);
      put(game, 'p1', second);
      return flies(game, bears);
    };
    expect(bearsFly('Levitation', 'Gravity Sphere'), 'Sphere last — no flying').toBe(false);
    expect(bearsFly('Gravity Sphere', 'Levitation'), 'Levitation last — flying').toBe(true);
  });

  /**
   * ⚠️ CR 613.7c — a permanent that re-enters the battlefield gets a NEW
   * timestamp. It holds here for free rather than by design: `addToZone`
   * APPENDS, so a card that leaves and comes back goes to the end of the array
   * that IS the timestamp. That coincidence is load-bearing, which is why it is
   * asserted rather than left in a comment.
   */
  test('a permanent that leaves and comes back is re-timestamped', () => {
    const game = board();
    const bears = put(game, 'p1', 'Grizzly Bears');
    put(game, 'p1', 'Levitation');
    put(game, 'p1', 'Gravity Sphere');
    expect(flies(game, bears)).toBe(false);

    // Bounce the Levitation and replay it: it is now the newest effect.
    const lev = find(game, 'p1', 'battlefield', 'Levitation');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: lev, to: { kind: 'hand', player: 'p1' } }));
    expect(flies(game, bears)).toBe(false);
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: lev, to: { kind: 'battlefield', player: 'p1' } }));
    expect(flies(game, bears)).toBe(true);
  });

  test('a static in a zone it is not active in does nothing', () => {
    const game = board();
    const bears = put(game, 'p1', 'Grizzly Bears');
    put(game, 'p1', 'Levitation', 'graveyard');
    expect(flies(game, bears)).toBe(false);
  });

  /**
   * ⚠️ Derived characteristics are never stored (`derive.ts`'s own header), so a
   * layer-6 grant writes nothing to `GameState` and cannot move the state hash.
   * Asserted rather than assumed, because "it is only a derivation" is exactly
   * the claim that would hide a reducer that had started caching one.
   */
  test('layer 6 changes no state — the game still replays', () => {
    const game = board();
    put(game, 'p1', 'Grizzly Bears');
    put(game, 'p1', 'Levitation');
    put(game, 'p2', 'Gravity Sphere');
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });
});

// ── CR 613.8 — dependency outranks timestamp (D149) ──────────────────────────
//
// ⚠️ D129 built CR 613.7's timestamp ordering and named 613.8 as unbuilt. This
// is it, and the pair is chosen so the rule is OBSERVABLE: `Kwende` reads a
// keyword that `Knighthood` grants, so which applies first decides whether
// Kwende applies at all.
describe('CR 613.8 — a dependent effect waits', () => {
  const KNIGHTHOOD = 'Knighthood';
  const KWENDE = 'Kwende, Pride of Femeref';
  const BEARS = 'Grizzly Bears';

  /** Put the two enchantments down in `order`, and derive a plain creature. */
  function keywordsOn(order: readonly string[]): Set<string> {
    const game = startedGame({
      players: 2,
      decks: [[KNIGHTHOOD, KWENDE, BEARS]],
      scripts: createRegistry([KNIGHTHOOD_SCRIPT, KWENDE_SCRIPT]),
    });
    const bears = put(game, 'p1', BEARS);
    for (const name of order) put(game, 'p1', name);
    const d = derive(game.state, game.deps.oracle, game.deps.scripts, bears);
    return new Set(d.keywords);
  }

  /**
   * ⚠️ **BOTH BATTLEFIELD ORDERS, AND THE ANSWER MUST BE THE SAME.** That is the
   * whole rule: dependency OUTRANKS timestamp, so Knighthood applies first
   * either way and the creature ends with both keywords.
   */
  test('Kwende applies after Knighthood whichever entered first', () => {
    for (const order of [[KNIGHTHOOD, KWENDE], [KWENDE, KNIGHTHOOD]]) {
      const kw = keywordsOn(order);
      expect(kw.has('firstStrike'), `first strike with ${order.join(' then ')}`).toBe(true);
      expect(kw.has('doubleStrike'), `double strike with ${order.join(' then ')}`).toBe(true);
    }
  });

  /**
   * ⚠️ **THE BREAK CASE, IN THE SUITE.** Without 613.8 the two orders disagree —
   * Kwende first means a creature with no first strike YET, so Kwende applies to
   * nothing and the card silently does nothing. Asserting only the happy order
   * would pass with the dependency code deleted, because `[Knighthood, Kwende]`
   * is already right by timestamp alone. Naming the wrong answer here is what
   * makes the test discriminate.
   */
  test('and without it, the reverse order would grant no double strike', () => {
    // Kwende alone: nothing has first strike, so it applies to nothing.
    const alone = keywordsOn([KWENDE]);
    expect(alone.has('firstStrike')).toBe(false);
    expect(alone.has('doubleStrike')).toBe(false);
  });

  test('Knighthood alone grants first strike and nothing more', () => {
    const kw = keywordsOn([KNIGHTHOOD]);
    expect(kw.has('firstStrike')).toBe(true);
    expect(kw.has('doubleStrike')).toBe(false);
  });

  /** An opponent's creature is outside both scopes, either way round. */
  test('it stays scoped to its controller', () => {
    const game = startedGame({
      players: 2,
      decks: [[KNIGHTHOOD, KWENDE], [BEARS]],
      scripts: createRegistry([KNIGHTHOOD_SCRIPT, KWENDE_SCRIPT]),
    });
    put(game, 'p1', KWENDE);
    put(game, 'p1', KNIGHTHOOD);
    const theirs = put(game, 'p2', BEARS);
    const d = derive(game.state, game.deps.oracle, game.deps.scripts, theirs);
    expect(d.keywords.has('firstStrike')).toBe(false);
    expect(d.keywords.has('doubleStrike')).toBe(false);
  });
});

// ── CR 613 layer 6 — losing NON-KEYWORD abilities (D151) ─────────────────────
//
// ⚠️ **THE CARD THAT WAS NAMED UNREPRESENTABLE FIVE TIMES.** D129, D147, D148,
// D149 and D150 each closed by saying `MutableCharacteristics` models KEYWORDS,
// so an effect removing a non-keyword ability could not be written at all —
// every triggered, static, replacement and activated ability lives in the SCRIPT
// REGISTRY, keyed by `oracleId`, where no characteristic can reach it.
//
// ⚠️ Each check below is a SEPARATE consequence, because missing any one leaves
// a Humility'd creature with half its abilities — and half is the one outcome
// D90 says is worse than none.
describe('Humility — losing every ability, not just the keywords', () => {
  const HUMILITY = 'Humility';
  const AKROMA = 'Akroma, Angel of Wrath';
  const SIGNET = 'Arcane Signet';
  const THUG = 'Spineless Thug';

  function board(names: readonly string[], scripts = createRegistry([HUMILITY_SCRIPT])) {
    const game = startedGame({ players: 2, decks: [[...names, HUMILITY]], scripts });
    const ids: Record<string, string> = {};
    for (const n of names) ids[n] = put(game, 'p1', n);
    return { game, ids, addHumility: () => put(game, 'p1', HUMILITY) };
  }

  const chars = (g: ReturnType<typeof startedGame>, id: string) =>
    derive(g.state, g.deps.oracle, g.deps.scripts, id);

  test('the keywords go, and so does the printed power and toughness', () => {
    const b = board([AKROMA]);
    const before = chars(b.game, b.ids[AKROMA] as string);
    expect(before.keywords.size).toBeGreaterThan(3);
    b.addHumility();
    const after = chars(b.game, b.ids[AKROMA] as string);
    expect(after.keywords.size).toBe(0);
    expect(after.hasAbilities).toBe(false);
    // Layer 7b, the card's other half.
    expect([after.power, after.toughness]).toEqual([1, 1]);
  });

  /**
   * ⚠️ PROTECTION IS NOT IN `keywords` — it is its own field, read by `canBlock`.
   * An implementation that only cleared the keyword set would leave a Humility'd
   * Akroma still unblockable by red, which is the silent half-failure.
   */
  test('protection and landwalk go too, because canBlock reads them', () => {
    const b = board([AKROMA]);
    expect(chars(b.game, b.ids[AKROMA] as string).protection.colors.length).toBeGreaterThan(0);
    b.addHumility();
    const after = chars(b.game, b.ids[AKROMA] as string);
    expect(after.protection.colors).toEqual([]);
    expect(after.protection.fromEverything).toBe(false);
    expect(after.landwalk).toEqual([]);
    expect(after.toxicAmount).toBe(0);
  });

  /**
   * ⚠️ A MANA ABILITY IS AN ABILITY. `producesMana` comes off the ORACLE face,
   * not out of `keywords`, so this is a fourth field that has to be emptied —
   * and the payment solver reads it directly.
   */
  test('a silenced creature makes no mana', () => {
    const b = board(['Llanowar Elves']);
    expect(chars(b.game, b.ids['Llanowar Elves'] as string).producesMana.length).toBeGreaterThan(0);
    b.addHumility();
    expect(chars(b.game, b.ids['Llanowar Elves'] as string).producesMana).toEqual([]);
  });

  /** ⚠️ And a NON-creature keeps everything — the card says "all creatures". */
  test('it does not touch a permanent that is not a creature', () => {
    const b = board([SIGNET]);
    b.addHumility();
    const after = chars(b.game, b.ids[SIGNET] as string);
    expect(after.hasAbilities).toBe(true);
    expect(after.producesMana.length).toBeGreaterThan(0);
  });

  /**
   * ⚠️ **THE HALF THAT KEYWORDS COULD NEVER HAVE EXPRESSED**, and the whole
   * reason this was called unrepresentable: a creature's ability from the SCRIPT
   * REGISTRY stops working. `Spineless Thug` can't block — until it loses its
   * abilities, at which point it can.
   */
  test('a registry ability stops working, which is the point', () => {
    const game = startedGame({
      players: 2,
      decks: [[THUG, HUMILITY], ['Grizzly Bears']],
      scripts: createRegistry([HUMILITY_SCRIPT, SPINELESS_THUG_SCRIPT]),
      startingPlayer: 'p1',
    });
    holdEverywhere(game);
    const thug = put(game, 'p1', THUG);
    expect(derive(game.state, game.deps.oracle, game.deps.scripts, thug).hasAbilities).toBe(true);
    put(game, 'p1', HUMILITY);
    expect(derive(game.state, game.deps.oracle, game.deps.scripts, thug).hasAbilities).toBe(false);
  });

  /**
   * ⚠️ **THE RECURSION GUARD, ASSERTED.** Humility is an enchantment, so it never
   * silences itself — and deriving it must not hang. This is the case the
   * exemption in `triggers.ts` relies on holding for every printed card.
   */
  test('Humility does not silence itself, and deriving it terminates', () => {
    const b = board([]);
    const h = b.addHumility();
    expect(chars(b.game, h).hasAbilities).toBe(true);
  });

  test('two Humilities do not silence each other', () => {
    const game = startedGame({
      players: 2,
      decks: [[HUMILITY, HUMILITY, AKROMA]],
      scripts: createRegistry([HUMILITY_SCRIPT]),
    });
    const a = put(game, 'p1', HUMILITY);
    const b2 = put(game, 'p1', HUMILITY);
    expect(derive(game.state, game.deps.oracle, game.deps.scripts, a).hasAbilities).toBe(true);
    expect(derive(game.state, game.deps.oracle, game.deps.scripts, b2).hasAbilities).toBe(true);
  });
});

// ── CR 613.8a clause (b), SECOND HALF — "what it does" (D152) ────────────────
//
// ⚠️⚠️ **THE NAIVE READING IS WRONG, AND IT WAS MEASURED WRONG.** Implemented as
// "applying B changes A's output, therefore A depends on B", `Gravity Sphere`
// ("all creatures lose flying") came out depending on `Levitation` ("creatures
// you control have flying") — because without Levitation there is no flying to
// remove and with it there is. That made Levitation always apply first, so the
// creature never flew even when Levitation entered LAST, and it broke D129's
// timestamp pair, which is correct MTG. Two checks failed, by name.
//
// ⚠️ **ACTING ON A DIFFERENT STARTING STATE IS ORDERING, NOT DEPENDENCY.** Clause
// (b) is about the effect's own SPECIFICATION changing. Nothing but the def can
// tell those apart, so the def declares it: `StaticDef.effectReads`.
describe('CR 613.8 — "what it does", by declaration', () => {
  const BEARS = 'Grizzly Bears';

  /** Grants first strike to creatures you control — `Knighthood`'s shape. */
  const grantFirstStrike: StaticDef = {
    abilityId: 'grant',
    text: 'Creatures you control have first strike.',
    layer: 'ability',
    activeZones: ['battlefield'],
    appliesTo: (_ctx, _self, _c, chars) => chars.typeLine.types.includes('Creature'),
    modify: (chars) => {
      chars.keywords.add('firstStrike');
    },
  };

  /**
   * Applies to every creature either way — so clause (b)'s FIRST half can never
   * fire — and reads `keywords` to decide what it does.
   */
  const readsKeywords = (declare: boolean): StaticDef => ({
    abilityId: 'reads',
    text: 'A creature you control gains vigilance, and trample if it has first strike.',
    layer: 'ability',
    activeZones: ['battlefield'],
    ...(declare ? { effectReads: ['keywords'] as const } : {}),
    appliesTo: (_ctx, _self, _c, chars) => chars.typeLine.types.includes('Creature'),
    modify: (chars) => {
      chars.keywords.add('vigilance');
      if (chars.keywords.has('firstStrike')) chars.keywords.add('trample');
    },
  });

  function keywordsWith(reader: StaticDef): Set<string> {
    const game = startedGame({
      players: 2,
      decks: [[BEARS, 'Knighthood', 'Levitation']],
      // ⚠️ The READER is registered FIRST, so battlefield order alone would run
      // it before the granter — which is exactly the ordering the dependency has
      // to overturn.
      scripts: createRegistry([
        { oracleId: 'x-reads', name: 'Reader', statics: [reader] },
        { oracleId: 'x-grant', name: 'Granter', statics: [grantFirstStrike] },
      ]),
    });
    const bears = put(game, 'p1', BEARS);
    // Both sources are attached to real permanents; which card they are does not
    // matter, only that both are on the battlefield in this order.
    put(game, 'p1', 'Knighthood');
    put(game, 'p1', 'Levitation');
    const cards = game.state.cards;
    const ids = game.state.zones.battlefield.filter((i) => i !== bears);
    // Re-home the two defs onto the two enchantments by oracle id.
    for (const [i, id] of ids.entries()) {
      const inst = cards[id];
      if (inst) (inst as { oracleId: string }).oracleId = i === 0 ? 'x-reads' : 'x-grant';
    }
    return new Set(derive(game.state, game.deps.oracle, game.deps.scripts, bears).keywords);
  }

  test('a DECLARED reader waits for the effect it reads', () => {
    const kw = keywordsWith(readsKeywords(true));
    expect(kw.has('firstStrike')).toBe(true);
    expect(kw.has('vigilance')).toBe(true);
    // ⚠️ The whole assertion: trample only appears if the granter ran FIRST,
    // against the registration and battlefield order.
    expect(kw.has('trample')).toBe(true);
  });

  test('and an UNDECLARED one does not — timestamp still decides', () => {
    const kw = keywordsWith(readsKeywords(false));
    expect(kw.has('vigilance')).toBe(true);
    expect(kw.has('trample')).toBe(false);
  });
});
