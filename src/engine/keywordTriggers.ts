// D308 - THE KEYWORD-TRIGGER SEAM. A keyword ability that IS a triggered ability
// - prowess, exalted, bushido N, flanking, persist, undying, evolve - runs from
// this one table for every permanent whose DERIVED keywords carry it, printed or
// granted, with no script per card. The bus (`triggers.ts`) walks the table
// beside the scripts' defs; `resolveAbility` finds the def by the `#kw:<name>`
// ref (`keywordTriggerDef`). Each entry is a `TriggerDef` minus the fields a
// card's def owns (its printed line, its zones): the same `matches` / `resolve`
// contract, the same `ScriptCtx`, the same events - so a keyword trigger is
// indistinguishable from a scripted one downstream.
//
// ⚠️ A keyword's NUMBER (bushido 2) is read off the printed text at resolution
// (`keywordAmount`), never stored: the amount is characteristic-defining text
// the derive does not carry, and a granted bushido with no number is 1.

import { parseTargetClauses } from '../data/targetParse';
import { readUpkeepPrice, type UpkeepPrice } from '../data/oracleParse';
import { vocabularyEffects } from './scripts/vocabulary';
import { TOKEN_TABLE, type TokenRef } from '../data/tokenTable';
import { madnessCastSpec, mobilizeSacrificeSpec, stormCopySpec } from '../data/effectParse';
import type { ScriptCtx, TriggerDef } from './scripts/api';
import type { EventBody, EventKind } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import type { EffectSpec, Keyword, ModeDecl, TargetSpec } from './types/oracle';
import type { DefenderRef, DelayedTrigger, StackObject } from './types/state';
import { faceOf } from './oracle';
import { narrated } from './narrate';
import { shuffle, type RngState } from './rng';

export interface KeywordTrigger {
  /**
   * D450 - the keyword that GATES this entry when it is not the map's key: a keyword with two triggers
   * (vanishing's upkeep tick and its last-counter sacrifice) keeps them under two keys, each firing for
   * every permanent whose derived keywords carry the one named here.
   */
  readonly keyword?: Keyword;
  readonly event: EventKind;
  readonly looksBack?: boolean;
  matches(ctx: ScriptCtx, self: InstanceId, ev: EventBody): boolean;
  /** The item each firing carries (`obj.item`): the lone attacker, the blocker, the entering creature. */
  perItem?(ctx: ScriptCtx, self: InstanceId, ev: EventBody): readonly InstanceId[];
  label(ctx: ScriptCtx, self: InstanceId): string;
  /**
   * D361 - a "you may" keyword (soulshift). The bus copies it onto the pending
   * trigger and D128's prompt asks on resolution, exactly as it does for a
   * script's def: a keyword trigger stays indistinguishable from a scripted one.
   */
  readonly optional?: boolean;
  /**
   * D440 - a NUMBER read off the state the entry matched against (the pre-event state for a looks-back entry) and
   * carried onto the stack object (`obj.memo`): what a modular creature's counters were as it died, which the
   * resolution cannot read any more (they clear as the card leaves the battlefield).
   */
  memo?(ctx: ScriptCtx, self: InstanceId, ev: EventBody): number;
  /**
   * D361 - the target clauses the keyword declares; absent for the ones that aim
   * at nothing (all seven of D308's).
   *
   * ⚠️ A FUNCTION, not an array, and for the table's own reason: a keyword's
   * NUMBER is read off the printed text at resolution and never stored, so
   * soulshift's mana-value bound is not known until the trigger is collected.
   * The clauses are handed to `parseTargetClauses` — the reader every card script
   * uses — rather than hand-built, so a keyword's aim cannot drift from what the
   * engine's own parser produces for the same printed words.
   */
  targets?(ctx: ScriptCtx, self: InstanceId): readonly TargetSpec[];
  /**
   * D459 - a MODAL keyword trigger (fabricate): the modes ride onto the pending trigger the way a def's do
   * (D343 - chosen as it goes on the stack, `obj.modes` at resolution), one to be chosen unless `modeChoice` says.
   */
  modes?(ctx: ScriptCtx, self: InstanceId): readonly ModeDecl[];
  readonly modeChoice?: { readonly min: number; readonly max: number };
  resolve(ctx: ScriptCtx, self: InstanceId, obj: StackObject): readonly EventBody[];
  /**
   * D525 - the entry fires off the SPELL ON THE STACK (cascade), not a permanent: the bus asks the cast card of a
   * `SpellCast` event - its DERIVED keywords, CR 613's silence - instead of walking the battlefield.
   */
  readonly fromStack?: true;
  /**
   * D541 - the entry fires off a MOVED CARD (madness): the bus asks the cards a `CardsMoved` event carried, where the move
   * put them - no battlefield walk, no derived keyword (the card is in exile); `matches` reads the move itself.
   */
  readonly fromMove?: true;
  /**
   * D536 - the entry's own EFFECTS (storm's copies): carried onto the stack object as `delayedEffects` and run by the
   * vocabulary's executor at resolution (D402's path), so a clause that asks (a copy's new targets) rides the continuation.
   */
  effects?(ctx: ScriptCtx, self: InstanceId, ev: EventBody): readonly EffectSpec[];
  /**
   * D525 - a resolution that CONSUMES RANDOMNESS (cascade's bottoming in a random order) takes the generator and hands
   * back the advanced one beside its events; the loop records it as `rngAfter` (the replay rule `effects.ts` states).
   * `resolve` stays the narrow entry for a caller that cannot thread it - the loop never is.
   */
  resolveRandom?(ctx: ScriptCtx, self: InstanceId, obj: StackObject, rng: RngState): { readonly events: readonly EventBody[]; readonly rng: RngState };
}

const nameOf = (ctx: ScriptCtx, id: InstanceId): string => {
  const card = ctx.state.cards[id];
  const printing = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
  return card && printing ? faceOf(printing, card.faceIndex).name : 'a permanent';
};

/** The printed number after a keyword ("bushido 2"), 1 when none is printed (a granted keyword). */
export function keywordAmount(ctx: ScriptCtx, id: InstanceId, keyword: string): number {
  const card = ctx.state.cards[id];
  const printing = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
  const text = card && printing ? faceOf(printing, card.faceIndex).oracleText : '';
  const m = new RegExp(`\\b${keyword} (\\d+)\\b`, 'i').exec(text);
  const n = m ? Number(m[1]) : 1;
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * D525 - how many times the printed keyword line says `cascade` (Apex Devastator: four - CR 702.85b, each its own
 * trigger); 1 for a keyword the line does not print (a granted one). Only a KEYWORD line counts: `Whenever you cast a
 * spell with cascade` is a sentence, not a printing of the ability.
 */
function cascadeCount(ctx: ScriptCtx, id: InstanceId): number {
  const card = ctx.state.cards[id];
  const printing = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
  const text = card && printing ? faceOf(printing, card.faceIndex).oracleText : '';
  let n = 0;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    if (/^cascade(?:, cascade)*$/.test(line)) n += line.split('cascade').length - 1;
  }
  return n > 0 ? n : 1;
}

/** D525 - a spell's mana value AS CAST: the printed value with X as chosen (CR 202.3b), read at the firing. */
function spellManaValue(ctx: ScriptCtx, obj: StackObject): number {
  if (obj.card === null) return 0;
  const card = ctx.state.cards[obj.card];
  const printing = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
  if (!card || !printing) return 0;
  const face = faceOf(printing, obj.faceIndex);
  return printing.manaValue + (obj.xValue ?? 0) * (face.manaCost?.xCount ?? 0);
}

/**
 * D525 - CASCADE resolves (CR 702.85a): the controller's library from the top, each card to exile, until a nonland
 * card whose mana value is less than the memo (the spell's, as cast); the cards that were not it go to the bottom in a
 * random order NOW (the generator advances through `rng`), and the one that was waits on the controller: a play
 * permission for this turn and the free-cast chooser over a POOL of one (`handlers.ts` casts it, or bottoms it too).
 */
function cascadeResolve(ctx: ScriptCtx, self: InstanceId, obj: StackObject, rng: RngState): { readonly events: readonly EventBody[]; readonly rng: RngState } {
  const state = ctx.state;
  const player = obj.controller;
  const bound = obj.memo ?? 0;
  const lib = state.zones.library[player] ?? [];
  const exiled: InstanceId[] = [];
  let hit: InstanceId | null = null;
  // The library is bottom-first: the last entry is the top.
  for (let i = lib.length - 1; i >= 0; i--) {
    const id = lib[i];
    if (id === undefined) break;
    exiled.push(id);
    const inst = state.cards[id];
    const printing = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
    if (!inst || !printing) continue;
    if (!faceOf(printing, 0).isLand && printing.manaValue < bound) {
      hit = id;
      break;
    }
  }
  const label = `${nameOf(ctx, self)} - cascade`;
  const out: EventBody[] = [];
  if (exiled.length === 0) {
    out.push(narrated(`${label}: the library is empty.`, player));
    return { events: out, rng };
  }
  const ownerOf = (card: InstanceId): PlayerId => state.cards[card]?.owner ?? player;
  out.push({ t: 'CardsMoved', moves: exiled.map((card) => ({ card, from: { kind: 'library' as const, player }, to: { kind: 'exile' as const, player: ownerOf(card) } })) });
  const rest = exiled.filter((card) => card !== hit);
  const mixed = shuffle(rng, rest);
  if (mixed.value.length > 0) {
    out.push({ t: 'CardsMoved', moves: mixed.value.map((card) => ({ card, from: { kind: 'exile' as const, player: ownerOf(card) }, to: { kind: 'library' as const, player }, placement: 'bottom' as const })) });
  }
  const n = exiled.length;
  if (hit === null) {
    out.push(narrated(`${label}: ${n} card${n === 1 ? '' : 's'} exiled and put on the bottom of the library in a random order - no nonland card with a lesser mana value among them.`, player));
    return { events: out, rng: mixed.next };
  }
  out.push({ t: 'PlayPermissionGranted', permission: { card: hit, player, until: 'thisTurn', grantedTurn: state.turn.turnNumber } });
  out.push({ t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player, zone: 'exile', rest: null, count: 1, min: 0, label, castFree: true, pool: [hit] } });
  out.push(narrated(`${label}: ${n} card${n === 1 ? '' : 's'} exiled; ${nameOf(ctx, hit)} may be cast without paying its mana cost.`, player));
  return { events: out, rng: mixed.next };
}

const onBattlefield = (ctx: ScriptCtx, id: InstanceId): boolean => ctx.state.cards[id]?.zone.kind === 'battlefield';

/** The battlefield → graveyard move of this permanent, which is what "dies" means (CR 700.4). */
const diedThisEvent = (self: InstanceId, ev: EventBody): boolean =>
  ev.t === 'CardsMoved' &&
  ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard');

/** The player a defender resolves to: a player is itself, a planeswalker or battle is its controller. */
function defenderPlayer(ctx: ScriptCtx, ref: DefenderRef): PlayerId | null {
  if (ref.kind === 'player') return ref.id;
  return ctx.state.cards[ref.id]?.controller ?? null;
}

/**
 * The player this creature is attacking, read off the combat record.
 *
 * ⚠️ READ AT RESOLUTION, which is the bound worth stating: a `resolve` receives
 * the STACK OBJECT and not the event (D185), and this engine carries no last
 * known information for a permanent that has left combat (D352's modular, one
 * keyword over). An attacker somebody removed from combat in response therefore
 * does nothing rather than paying against a stale defender.
 */
function attackedPlayer(ctx: ScriptCtx, self: InstanceId): PlayerId | null {
  const decl = (ctx.state.combat?.attackers ?? []).find((a) => a.card === self);
  return decl ? defenderPlayer(ctx, decl.defender) : null;
}

/** The greatest life total among the players still in the game (CR 800.4a). */
function mostLife(ctx: ScriptCtx): number {
  let best = -Infinity;
  for (const p of Object.values(ctx.state.players)) {
    if (p.hasLost) continue;
    if (p.life > best) best = p.life;
  }
  return best;
}

/**
 * Soulshift's printed clause at the amount this card prints.
 *
 * ⚠️ RECONSTRUCTED FROM THE NUMBER, never read off a printing's reminder text:
 * reminder text is a property of the PRINTING, so a printing that omits it would
 * silently lose the aim. The words are the reminder's own.
 */
/** D440 - extort's whole text as the vocabulary reads it: D369's pay prompt with D439's drain rider as its body. */
const EXTORT_TEXT = 'You may pay {W/B}. If you do, each opponent loses 1 life. You gain life equal to the life lost this way.';
/** D440 - a modular creature's number, off the printed line (`keywordAmount` reads `modular N`). */
const MODULAR_TEXT = 'When this creature dies, you may put its +1/+1 counters on target artifact creature.';
/** D445 - backup's target clause (CR 702.165a); the number and the grants are the face's (`OracleFace.backup`). */
const BACKUP_TEXT = 'When this creature enters, put N +1/+1 counters on target creature.';
/** D445 - the face's backup reading for one permanent, at resolution (the one reader). */
function backupOf(ctx: ScriptCtx, id: InstanceId): { n: number; grants: readonly Keyword[] } | null {
  const card = ctx.state.cards[id];
  const printing = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
  return card && printing ? faceOf(printing, card.faceIndex).backup : null;
}
/** The move of this permanent ONTO the battlefield from anywhere else, which is what "enters" means. */
const enteredThisEvent = (self: InstanceId, ev: EventBody): boolean =>
  ev.t === 'CardsMoved' &&
  ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield');
function soulshiftText(n: number): string {
  return `When this creature dies, you may return target Spirit card with mana value ${n} or less from your graveyard to your hand.`;
}

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

/** The token `afterlife` makes. ⚠️ Pinned in `WANTED_TOKENS` too, or it derives to a nameless 0/0 (D133/D298). */
const AFTERLIFE_SPIRIT = tokenRef('Spirit|1/1|BW|Creature|flying');
/** D459 - the token `fabricate` may make. ⚠️ Pinned in `WANTED_TOKENS` too (the same reason). */
const FABRICATE_SERVO = tokenRef('Servo|1/1||Artifact Creature|');
/** D463 - the token `mobilize` makes. ⚠️ Pinned in `WANTED_TOKENS` too (the same reason). */
const MOBILIZE_WARRIOR = tokenRef('Warrior|1/1|R|Creature|');
const isCreature = (ctx: ScriptCtx, id: InstanceId): boolean => ctx.derive(id).typeLine.types.includes('Creature');

export const KEYWORD_TRIGGERS: ReadonlyMap<string, KeywordTrigger> = new Map<string, KeywordTrigger>([
  [
    'prowess',
    {
      // CR 702.108a - whenever you cast a noncreature spell, +1/+1 until end of turn.
      event: 'SpellCast',
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !isCreature(ctx, ev.obj.card),
      label: (ctx, self) => `${nameOf(ctx, self)} - prowess`,
      resolve: (ctx, self) => (onBattlefield(ctx, self) ? [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }] : []),
    },
  ],
  [
    'exalted',
    {
      // CR 702.83a - whenever a creature you control attacks alone, it gets +1/+1 until end of turn.
      event: 'AttackersDeclared',
      matches: (ctx, self, ev) => {
        if (ev.t !== 'AttackersDeclared' || ev.attackers.length !== 1) return false;
        const alone = ev.attackers[0];
        return alone !== undefined && ctx.state.cards[alone.card]?.controller === ctx.query.controllerOf(self);
      },
      perItem: (_ctx, _self, ev) => (ev.t === 'AttackersDeclared' && ev.attackers[0] ? [ev.attackers[0].card] : []),
      label: (ctx, self) => `${nameOf(ctx, self)} - exalted`,
      resolve: (ctx, _self, obj) =>
        obj.item !== undefined && onBattlefield(ctx, obj.item) ? [{ t: 'PtModifiedUntilEndOfTurn', card: obj.item, power: 1, toughness: 1 }] : [],
    },
  ],
  [
    'bushido',
    {
      // CR 702.46a - whenever this creature blocks or becomes blocked, it gets +N/+N until end of turn.
      event: 'BlockersDeclared',
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self || b.attacker === self),
      label: (ctx, self) => `${nameOf(ctx, self)} - bushido ${keywordAmount(ctx, self, 'bushido')}`,
      resolve: (ctx, self) => {
        if (!onBattlefield(ctx, self)) return [];
        const n = keywordAmount(ctx, self, 'bushido');
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: n, toughness: n }];
      },
    },
  ],
  [
    'flanking',
    {
      // CR 702.25a - whenever a creature without flanking blocks this creature, the blocker gets -1/-1 until end of turn.
      event: 'BlockersDeclared',
      matches: (ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.attacker === self && !ctx.derive(b.blocker).keywords.has('flanking')),
      perItem: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.attacker === self && !ctx.derive(b.blocker).keywords.has('flanking')).map((b) => b.blocker) : [],
      label: (ctx, self) => `${nameOf(ctx, self)} - flanking`,
      resolve: (ctx, _self, obj) =>
        obj.item !== undefined && onBattlefield(ctx, obj.item) ? [{ t: 'PtModifiedUntilEndOfTurn', card: obj.item, power: -1, toughness: -1 }] : [],
    },
  ],
  [
    'persist',
    {
      // CR 702.79a - when this creature dies, if it had no -1/-1 counters on it, return it under its owner's control with a -1/-1 counter.
      event: 'CardsMoved',
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard') &&
        (ctx.state.cards[self]?.counters['-1/-1'] ?? 0) === 0,
      label: (ctx, self) => `${nameOf(ctx, self)} - persist`,
      resolve: (ctx, self) => {
        const card = ctx.state.cards[self];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [
          { t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'battlefield', player: card.owner } }] },
          { t: 'CountersChanged', changes: [{ card: self, kind: '-1/-1', delta: 1 }] },
        ];
      },
    },
  ],
  [
    'undying',
    {
      // CR 702.93a - when this creature dies, if it had no +1/+1 counters on it, return it under its owner's control with a +1/+1 counter.
      event: 'CardsMoved',
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard') &&
        (ctx.state.cards[self]?.counters['+1/+1'] ?? 0) === 0,
      label: (ctx, self) => `${nameOf(ctx, self)} - undying`,
      resolve: (ctx, self) => {
        const card = ctx.state.cards[self];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [
          { t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'battlefield', player: card.owner } }] },
          { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] },
        ];
      },
    },
  ],
  [
    'evolve',
    {
      // CR 702.100a - whenever a creature you control enters, if it has greater power or toughness than this creature, put a +1/+1 counter on this creature.
      event: 'CardsMoved',
      matches: (ctx, self, ev) => ev.t === 'CardsMoved' && evolveEntrants(ctx, self, ev).length > 0,
      perItem: (ctx, self, ev) => evolveEntrants(ctx, self, ev),
      label: (ctx, self) => `${nameOf(ctx, self)} - evolve`,
      resolve: (ctx, self, obj) => {
        if (!onBattlefield(ctx, self) || obj.item === undefined || !onBattlefield(ctx, obj.item)) return [];
        // The intervening "if" asked again on resolution (CR 603.4).
        const mine = ctx.derive(self);
        const theirs = ctx.derive(obj.item);
        if ((theirs.power ?? 0) <= (mine.power ?? 0) && (theirs.toughness ?? 0) <= (mine.toughness ?? 0)) return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }];
      },
    },
  ],
  // ── D361 — THE TABLE, PART 2 ──────────────────────────────────────────────
  [
    'soulshift',
    {
      // CR 702.46a - when this permanent dies, you may return target Spirit card
      // with mana value N or less from your graveyard to your hand.
      //
      // ⚠️ THE FIRST KEYWORD TRIGGER THAT IS OPTIONAL AND THAT TARGETS. Both ride
      // machinery a script's def has used since D128 and D147; what is new is that
      // the bus copies them off the TABLE as well as off a def.
      event: 'CardsMoved',
      looksBack: true,
      optional: true,
      targets: (ctx, self) => parseTargetClauses(soulshiftText(keywordAmount(ctx, self, 'soulshift'))),
      matches: (_ctx, self, ev) => diedThisEvent(self, ev),
      label: (ctx, self) => `${nameOf(ctx, self)} - soulshift ${keywordAmount(ctx, self, 'soulshift')}`,
      resolve: (ctx, _self, obj) => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        if (card.zone.player !== obj.controller) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              { card: target.id, from: { kind: 'graveyard', player: card.zone.player }, to: { kind: 'hand', player: obj.controller } },
            ],
          },
        ];
      },
    },
  ],
  [
    'afterlife',
    {
      // CR 702.134a - when this creature dies, create N 1/1 white and black Spirit
      // creature tokens with flying.
      event: 'CardsMoved',
      looksBack: true,
      matches: (_ctx, self, ev) => diedThisEvent(self, ev),
      label: (ctx, self) => `${nameOf(ctx, self)} - afterlife ${keywordAmount(ctx, self, 'afterlife')}`,
      resolve: (ctx, self, obj) => {
        const n = keywordAmount(ctx, self, 'afterlife');
        const out: EventBody[] = [];
        // ⚠️ One id per token from the ADVANCING allocator (D164): a resolve that
        // read the same id twice would overwrite its own first token.
        for (let i = 0; i < n; i++) {
          out.push({
            t: 'TokenCreated',
            card: ctx.ids.nextInstance(),
            oracleId: AFTERLIFE_SPIRIT.oracleId,
            printingId: AFTERLIFE_SPIRIT.printingId,
            controller: obj.controller,
            owner: obj.controller,
            turnNumber: ctx.state.turn.turnNumber,
          });
        }
        return out;
      },
    },
  ],
  [
    'dethrone',
    {
      // CR 702.103a - whenever this creature attacks the player with the most life
      // or tied for most life, put a +1/+1 counter on it.
      //
      // ⚠️ The comparison is over the players still IN the game (CR 800.4a) and is
      // asked at the DECLARATION: a life total that moves before the trigger
      // resolves does not un-trigger it.
      event: 'AttackersDeclared',
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ev.attackers.some((a) => {
          if (a.card !== self) return false;
          if (a.defender.kind !== 'player') return false;
          const life = ctx.state.players[a.defender.id]?.life;
          return life !== undefined && life >= mostLife(ctx);
        }),
      label: (ctx, self) => `${nameOf(ctx, self)} - dethrone`,
      resolve: (ctx, self) =>
        onBattlefield(ctx, self) ? [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }] : [],
    },
  ],
  [
    'melee',
    {
      // CR 702.120a - whenever this creature attacks, it gets +1/+1 until end of
      // turn for each opponent you attacked this combat.
      //
      // ⚠️ The COUNT is read at resolution off the combat record rather than off the
      // event, because a resolve receives the stack object and not the event (D185)
      // - and the record is that same declaration.
      event: 'AttackersDeclared',
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: (ctx, self) => `${nameOf(ctx, self)} - melee`,
      resolve: (ctx, self, obj) => {
        if (!onBattlefield(ctx, self)) return [];
        const hit = new Set<PlayerId>();
        for (const a of ctx.state.combat?.attackers ?? []) {
          if (ctx.state.cards[a.card]?.controller !== obj.controller) continue;
          const p = defenderPlayer(ctx, a.defender);
          if (p !== null && p !== obj.controller) hit.add(p);
        }
        const n = hit.size;
        return n > 0 ? [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: n, toughness: n }] : [];
      },
    },
  ],
  [
    'training',
    {
      // CR 702.149a - whenever this creature attacks with another creature with
      // greater power, put a +1/+1 counter on this creature.
      //
      // ⚠️ The power comparison is part of the TRIGGER CONDITION rather than an
      // intervening "if": it is asked once, at the declaration, off both derived
      // powers.
      event: 'AttackersDeclared',
      matches: (ctx, self, ev) => {
        if (ev.t !== 'AttackersDeclared') return false;
        if (!ev.attackers.some((a) => a.card === self)) return false;
        const mine = ctx.derive(self).power ?? 0;
        return ev.attackers.some((a) => a.card !== self && (ctx.derive(a.card).power ?? 0) > mine);
      },
      label: (ctx, self) => `${nameOf(ctx, self)} - training`,
      resolve: (ctx, self) =>
        onBattlefield(ctx, self) ? [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }] : [],
    },
  ],
  [
    'afflict',
    {
      // CR 702.131a - whenever this creature becomes blocked, defending player loses
      // N life. One firing per declaration (CR 509.1g), which is what the event is.
      event: 'AttackerBecameBlocked',
      matches: (_ctx, self, ev) => ev.t === 'AttackerBecameBlocked' && ev.attackers.includes(self),
      label: (ctx, self) => `${nameOf(ctx, self)} - afflict ${keywordAmount(ctx, self, 'afflict')}`,
      resolve: (ctx, self) => {
        const player = attackedPlayer(ctx, self);
        if (player === null) return [];
        const life = ctx.state.players[player]?.life;
        if (life === undefined) return [];
        const n = keywordAmount(ctx, self, 'afflict');
        return [{ t: 'LifeChanged', player, delta: -n, to: life - n }];
      },
    },
  ],
  [
    'ingest',
    {
      // CR 702.115a - whenever this creature deals combat damage to a player, that
      // player exiles the top card of their library.
      event: 'CombatDamageDealt',
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player'),
      label: (ctx, self) => `${nameOf(ctx, self)} - ingest`,
      resolve: (ctx, self) => {
        // The player damaged is the one being attacked: combat damage reaches a
        // PLAYER only from an attacker whose defender is that player.
        const player = attackedPlayer(ctx, self);
        if (player === null) return [];
        const library = ctx.state.zones.library[player] ?? [];
        // The top of a library is the END of the array (`drawFromTop`).
        const top = library[library.length - 1];
        if (top === undefined) return [];
        return [{ t: 'CardsMoved', moves: [{ card: top, from: { kind: 'library', player }, to: { kind: 'exile', player } }] }];
      },
    },
  ],
  [
    'echo',
    {
      // D439 - CR 702.30a: at the beginning of your upkeep, if this permanent came under your control since the
      // beginning of your last upkeep, sacrifice it unless you pay its echo cost. The memory is the controller's
      // `lastUpkeepTurn` (their previous COMPLETED upkeep, `PlayerState`) against the card's `summonedOnTurn`:
      // it entered, or changed control, on or after that turn. A player's first upkeep echoes everything.
      event: 'StepBegan',
      matches: (ctx, self, ev) => {
        if (ev.t !== 'StepBegan' || ev.step !== 'upkeep') return false;
        const me = ctx.query.controllerOf(self);
        if (ctx.state.turn.activePlayer !== me) return false;
        const since = ctx.state.cards[self]?.summonedOnTurn ?? null;
        const last = ctx.state.players[me]?.lastUpkeepTurn ?? null;
        return since !== null && (last === null || since >= last);
      },
      label: (ctx, self) => `${nameOf(ctx, self)} - echo ${upkeepPriceOf(ctx, self, 'echo')?.text ?? ''}`.trim(),
      resolve: (ctx, self, obj) => upkeepPrompt(ctx, self, obj, upkeepPriceOf(ctx, self, 'echo'), 1),
    },
  ],
  [
    'cumulativeUpkeep',
    {
      // D439 - CR 702.24a: at the beginning of your upkeep, put an age counter on this permanent, then sacrifice
      // it unless you pay its upkeep cost for each age counter on it. The counter lands first (an event of this
      // resolution); the price is the printed one times the counters it then carries.
      event: 'StepBegan',
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: (ctx, self) => `${nameOf(ctx, self)} - cumulative upkeep ${upkeepPriceOf(ctx, self, 'cumulativeUpkeep')?.text ?? ''}`.trim(),
      resolve: (ctx, self, obj) => {
        if (ctx.state.cards[self]?.zone.kind !== 'battlefield') return [];
        const ages = (ctx.state.cards[self]?.counters['age'] ?? 0) + 1;
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: 'age', delta: 1 }] }, ...upkeepPrompt(ctx, self, obj, upkeepPriceOf(ctx, self, 'cumulativeUpkeep'), ages)];
      },
    },
  ],
  // ── D440 — THE TABLE, PART 3 ──────────────────────────────────────────────
  [
    'extort',
    {
      // CR 702.100a - whenever you cast a spell, you may pay {W/B}. If you do, each opponent loses 1 life and you
      // gain that much life. The vocabulary's own pay prompt (D369) with the scoped loss and its drain rider (D439)
      // as the paid body - the bot's answer, the driver's coin flip and the client's dialog for free.
      event: 'SpellCast',
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self),
      label: (ctx, self) => `${nameOf(ctx, self)} - extort`,
      resolve: (ctx, self, obj) => (onBattlefield(ctx, self) ? ctx.vocabulary(obj, vocabularyEffects(EXTORT_TEXT, nameOf(ctx, self)), []) : []),
    },
  ],
  [
    'modular',
    {
      // CR 702.43a - this enters with N +1/+1 counters (`withEntryCounters`, the built-in); when it dies, you may put
      // its +1/+1 counters on target artifact creature. The counters clear as the card leaves the battlefield, so
      // the head MEMOISES them off the pre-event state and the resolution reads `obj.memo` (D440's plumbing).
      event: 'CardsMoved',
      looksBack: true,
      optional: true,
      targets: () => parseTargetClauses(MODULAR_TEXT),
      matches: (_ctx, self, ev) => diedThisEvent(self, ev),
      memo: (ctx, self) => ctx.state.cards[self]?.counters['+1/+1'] ?? 0,
      label: (ctx, self) => `${nameOf(ctx, self)} - modular ${keywordAmount(ctx, self, 'modular')}`,
      resolve: (ctx, _self, obj) => {
        const n = obj.memo ?? 0;
        const target = obj.targets[0];
        if (n <= 0 || !target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        const chars = ctx.derive(target.id);
        if (!chars.typeLine.types.includes('Artifact') || !chars.typeLine.types.includes('Creature')) return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: n }] }];
      },
    },
  ],
  [
    'evoke',
    {
      // CR 702.74a - when this permanent enters, if its evoke cost was paid, its controller sacrifices it. The
      // mark is the cast's (`CardInstance.evoked`, off the resolving spell's `alternativePaid` and the face's
      // keyword alternative cost); a card cast for its mana cost enters unmarked and the trigger never fires.
      event: 'CardsMoved',
      optional: false,
      matches: (ctx, self, ev) => enteredThisEvent(self, ev) && ctx.state.cards[self]?.evoked === true,
      label: (ctx, self) => `${nameOf(ctx, self)} - evoke (sacrifice it)`,
      resolve: (ctx, self) => {
        const card = ctx.state.cards[self];
        if (!card || card.zone.kind !== 'battlefield' || card.evoked !== true) return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: null }, to: { kind: 'graveyard', player: card.owner }, reason: 'sacrifice' }] }];
      },
    },
  ],
  [
    'mobilize',
    {
      // CR 702.179a - whenever this creature attacks, create N 1/1 red Warrior creature tokens that are tapped and
      // attacking (the same defender); sacrifice them at the beginning of the next end step.
      event: 'AttackersDeclared',
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: (ctx, self) => `${nameOf(ctx, self)} - mobilize ${keywordAmount(ctx, self, 'mobilize')}`,
      resolve: (ctx, self, obj) => {
        const n = keywordAmount(ctx, self, 'mobilize');
        const defender = ctx.state.combat?.attackers.find((a) => a.card === self)?.defender;
        if (!defender || ctx.state.combat === null) return [];
        const out: EventBody[] = [];
        for (let i = 0; i < n; i++) {
          const id = ctx.ids.nextInstance();
          out.push({ t: 'TokenCreated', card: id, oracleId: MOBILIZE_WARRIOR.oracleId, printingId: MOBILIZE_WARRIOR.printingId, controller: obj.controller, owner: obj.controller, turnNumber: ctx.state.turn.turnNumber });
          out.push({ t: 'PermanentsTapped', cards: [id] });
          out.push({ t: 'AttackerAdded', card: id, defender });
          const trigger: DelayedTrigger = {
            id: `${obj.id}-mobilize-${i}`,
            controller: obj.controller,
            source: id,
            when: { step: 'end', whose: 'next' },
            armedTurn: ctx.state.turn.turnNumber,
            armedStep: ctx.state.turn.step,
            effects: [mobilizeSacrificeSpec()],
            label: 'Warrior - mobilize: sacrifice it',
          };
          out.push({ t: 'DelayedTriggerArmed', trigger });
        }
        return out;
      },
    },
  ],
  [
    'fabricate',
    {
      // CR 702.122a - when this permanent enters, put N +1/+1 counters on it or create N 1/1 colorless Servo artifact
      // creature tokens: a modal trigger, the mode chosen as it goes on the stack (D343).
      event: 'CardsMoved',
      matches: (_ctx, self, ev) => enteredThisEvent(self, ev),
      label: (ctx, self) => `${nameOf(ctx, self)} - fabricate ${keywordAmount(ctx, self, 'fabricate')}`,
      modes: (ctx, self) => {
        const n = keywordAmount(ctx, self, 'fabricate');
        return [{ text: `Put ${n} +1/+1 counter${n === 1 ? '' : 's'} on it` }, { text: `Create ${n} 1/1 colorless Servo artifact creature token${n === 1 ? '' : 's'}` }];
      },
      resolve: (ctx, self, obj) => {
        const n = keywordAmount(ctx, self, 'fabricate');
        if (obj.modes[0] === 0) {
          return onBattlefield(ctx, self) ? [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: n }] }] : [];
        }
        const out: EventBody[] = [];
        for (let i = 0; i < n; i++) {
          out.push({
            t: 'TokenCreated',
            card: ctx.ids.nextInstance(),
            oracleId: FABRICATE_SERVO.oracleId,
            printingId: FABRICATE_SERVO.printingId,
            controller: obj.controller,
            owner: obj.controller,
            turnNumber: ctx.state.turn.turnNumber,
          });
        }
        return out;
      },
    },
  ],
  [
    'vanishing',
    {
      // CR 702.63b - at the beginning of its controller's upkeep, if it has a time counter on it, remove one.
      event: 'StepBegan',
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self) && (ctx.state.cards[self]?.counters['time'] ?? 0) > 0,
      label: (ctx, self) => `${nameOf(ctx, self)} - vanishing (remove a time counter)`,
      resolve: (ctx, self) =>
        onBattlefield(ctx, self) && (ctx.state.cards[self]?.counters['time'] ?? 0) > 0 ? [{ t: 'CountersChanged', changes: [{ card: self, kind: 'time', delta: -1 }] }] : [],
    },
  ],
  [
    'vanishingLast',
    {
      // CR 702.63c - when the last time counter is removed from it, sacrifice it. The removal is read off the
      // event and the state after it (the counter gone), whichever ability removed it.
      keyword: 'vanishing',
      event: 'CountersChanged',
      matches: (ctx, self, ev) =>
        ev.t === 'CountersChanged' && ev.changes.some((c) => c.card === self && c.kind === 'time' && c.delta < 0) && (ctx.state.cards[self]?.counters['time'] ?? 0) === 0,
      label: (ctx, self) => `${nameOf(ctx, self)} - vanishing (sacrifice it)`,
      resolve: (ctx, self) => {
        const card = ctx.state.cards[self];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: null }, to: { kind: 'graveyard', player: card.owner }, reason: 'sacrifice' }] }];
      },
    },
  ],
  [
    'fading',
    {
      // CR 702.32a - at the beginning of its controller's upkeep, remove a fade counter from it; if you can't,
      // sacrifice it.
      event: 'StepBegan',
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: (ctx, self) => `${nameOf(ctx, self)} - fading (remove a fade counter or sacrifice it)`,
      resolve: (ctx, self) => {
        const card = ctx.state.cards[self];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if ((card.counters['fade'] ?? 0) > 0) return [{ t: 'CountersChanged', changes: [{ card: self, kind: 'fade', delta: -1 }] }];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: null }, to: { kind: 'graveyard', player: card.owner }, reason: 'sacrifice' }] }];
      },
    },
  ],
  [
    'backup',
    {
      // CR 702.165a - when this creature enters, put N +1/+1 counters on target creature; if that's another
      // creature, it gains the abilities printed below the Backup line until end of turn - the keywords the
      // parser read (`OracleFace.backup.grants`; a card with anything else below the line has no backup here).
      // The grant is D194's keyword rider on the until-end-of-turn entry, with no P/T beside it.
      event: 'CardsMoved',
      optional: false,
      targets: () => parseTargetClauses(BACKUP_TEXT),
      matches: (_ctx, self, ev) => enteredThisEvent(self, ev),
      label: (ctx, self) => `${nameOf(ctx, self)} - backup ${backupOf(ctx, self)?.n ?? 1}`,
      resolve: (ctx, self, obj) => {
        const read = backupOf(ctx, self);
        const target = obj.targets[0];
        if (!read || !target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || !ctx.derive(target.id).isCreature) return [];
        const out: EventBody[] = [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: read.n }] }];
        if (target.id !== self && read.grants.length > 0) {
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: [...read.grants] });
        }
        return out;
      },
    },
  ],
  [
    'cascade',
    {
      // D525 - CR 702.85a: when you cast this spell, exile cards from the top of your library until you exile a nonland
      // card whose mana value is less than this spell's; you may cast it without paying its mana cost; the exiled cards
      // go to the bottom in a random order. The entry fires off the SPELL on the stack (`fromStack`), once per printing
      // of the word (`cascadeCount`), and resolves BEFORE the spell - the trigger goes on above it. The mana value is
      // the spell's AS CAST, taken at the firing (`memo`): the spell may have left the stack by the resolution.
      event: 'SpellCast',
      fromStack: true,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.card === self && ev.obj.copyOf === undefined,
      perItem: (ctx, self) => Array.from({ length: cascadeCount(ctx, self) }, () => self),
      memo: (ctx, _self, ev) => (ev.t === 'SpellCast' ? spellManaValue(ctx, ev.obj) : 0),
      label: (ctx, self) => `${nameOf(ctx, self)} - cascade`,
      resolve: (ctx, self, obj) => cascadeResolve(ctx, self, obj, ctx.state.rng).events,
      resolveRandom: (ctx, self, obj, rng) => cascadeResolve(ctx, self, obj, rng),
    },
  ],
  [
    'storm',
    {
      // D536 - CR 702.40a: when you cast this spell, copy it for each other spell cast before it this turn; you may choose
      // new targets for any of the copies. The entry fires off the SPELL on the stack (`fromStack`, cascade's shape); the
      // count is taken at the firing (`stormCount` - a spell cast in response adds no copy), and the copies are the
      // entry's own effects (`stormCopySpec` - D487's copy aimed at the spell itself), run as the stack object's effects
      // so each copy's question rides the continuation to the next. `resolve` is never reached (the effects run first).
      event: 'SpellCast',
      fromStack: true,
      // A permanent spell's copies would be tokens the engine does not make (CR 707.10a): an instant or sorcery alone.
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.card === self && ev.obj.copyOf === undefined && !isPermanentSpell(ctx, self),
      memo: (ctx) => stormCount(ctx),
      effects: (ctx, _self, ev) => (ev.t === 'SpellCast' ? Array.from({ length: stormCount(ctx) }, () => stormCopySpec(ev.obj)) : []),
      label: (ctx, self) => `${nameOf(ctx, self)} - storm`,
      resolve: () => [],
    },
  ],
  [
    'madness',
    {
      // D541 - CR 702.35a: "When this card is exiled this way, its owner may cast it by paying [cost] rather than paying
      // its mana cost. If that player doesn't, they put this card into their graveyard." The entry fires off the MOVE
      // (`fromMove`) the discard replacement made (`CardMove.madness` - triggers.ts's built-in), its source the card in
      // exile; the offer is the entry's own effect (`madnessCastSpec`), run by the executor with the engine's deps.
      event: 'CardsMoved',
      fromMove: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.madness === true),
      effects: () => [madnessCastSpec()],
      label: (ctx, self) => `${nameOf(ctx, self)} - madness`,
      resolve: () => [],
    },
  ],
  [
    'partnerWith',
    {
      // D544 - PARTNER WITH (CR 702.124j): "When this permanent enters, target player may search their library for a card
      // named [name], reveal it, put it into their hand, then shuffle." Fired off the permanent's face-up entry (`fromMove` -
      // `Partner with` is no derived keyword); the search is the entry's own effect (`OracleFace.partnerWith`), asked of
      // the target player.
      event: 'CardsMoved',
      fromMove: true,
      matches: (ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && m.faceDown !== true) && partnerWithOf(ctx, self) !== null,
      targets: () => parseTargetClauses(PARTNER_WITH_TEXT),
      effects: (ctx, self) => { const s = partnerWithOf(ctx, self); return s ? [s] : []; },
      label: (ctx, self) => `${nameOf(ctx, self)} - partner with`,
      resolve: () => [],
    },
  ],
]);

/** D544 - the partner-with trigger's one target clause (the player who may search). */
const PARTNER_WITH_TEXT = 'Target player may search their library for a card.';
/** D544 - the face's partner-with search, off the printing of the card as it stands. */
function partnerWithOf(ctx: ScriptCtx, id: InstanceId) {
  const card = ctx.state.cards[id];
  const printing = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
  return card && printing ? faceOf(printing, card.faceIndex).partnerWith : null;
}

/**
 * D536 - the storm count (CR 702.40a): every spell cast this turn, by every player, before this one - read off the state
 * after the cast, so the spell's own cast is taken off (the turn's tally counts it by then).
 */
/** D536 - the cast card is a permanent spell (its face): storm copies only an instant or a sorcery here. */
function isPermanentSpell(ctx: ScriptCtx, id: InstanceId): boolean {
  const card = ctx.state.cards[id];
  const printing = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
  return card !== undefined && printing !== undefined && faceOf(printing, card.faceIndex).isPermanent;
}

function stormCount(ctx: ScriptCtx): number {
  const cast = Object.values(ctx.state.turn.spellsCast).reduce((a, b) => a + b, 0);
  return Math.max(0, cast - 1);
}

/** D439 - the printed echo / cumulative upkeep price of one permanent, read at resolution (the one reader). */
function upkeepPriceOf(ctx: ScriptCtx, id: InstanceId, keyword: 'echo' | 'cumulativeUpkeep'): UpkeepPrice | null {
  const card = ctx.state.cards[id];
  const printing = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
  return card && printing ? readUpkeepPrice(faceOf(printing, card.faceIndex).oracleText, keyword) : null;
}
/**
 * D439 - `sacrifice it unless you pay <price>`, the price taken `times` over: the vocabulary's own pay prompt
 * (D369 - a price the player cannot pay is no question, the permanent goes), so the prompt, the bot's answer, the
 * driver's coin flip and the client's dialog are the ones every `unless you pay` row already has. No printed
 * price (a keyword granted with none - nothing ships one) asks nothing and takes nothing.
 */
function upkeepPrompt(ctx: ScriptCtx, self: InstanceId, obj: StackObject, price: UpkeepPrice | null, times: number): readonly EventBody[] {
  if (price === null || ctx.state.cards[self]?.zone.kind !== 'battlefield') return [];
  const mana = price.mana === null ? '' : price.mana.repeat(times);
  const life = price.life * times;
  const priceText = mana !== '' && life > 0 ? `${mana} and ${life} life` : mana !== '' ? mana : `${life} life`;
  return ctx.vocabulary(obj, vocabularyEffects(`Sacrifice this permanent unless you pay ${priceText}.`, nameOf(ctx, self)), []);
}

function evolveEntrants(ctx: ScriptCtx, self: InstanceId, ev: EventBody): InstanceId[] {
  if (ev.t !== 'CardsMoved') return [];
  const mine = ctx.derive(self);
  const out: InstanceId[] = [];
  for (const m of ev.moves) {
    if (m.card === self || m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') continue;
    if (ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self)) continue;
    if (!isCreature(ctx, m.card)) continue;
    const theirs = ctx.derive(m.card);
    if ((theirs.power ?? 0) > (mine.power ?? 0) || (theirs.toughness ?? 0) > (mine.toughness ?? 0)) out.push(m.card);
  }
  return out;
}

/** The table entry a `#kw:<keyword>` ability ref names, or undefined for any other ref. */
export function keywordTriggerEntry(abilityRef: string): KeywordTrigger | undefined {
  const at = abilityRef.indexOf('#kw:');
  if (at < 0) return undefined;
  return KEYWORD_TRIGGERS.get(abilityRef.slice(at + 4));
}

/**
 * D361 - the target clauses behind a keyword trigger on the stack, asked of the
 * table the way a script def's are read off the def.
 *
 * ⚠️ CR 608.2b's re-check needs these: without them a soulshift aimed at a card
 * somebody exiled in response would still count as legal, and the resolve would
 * run against a card that had left the graveyard.
 */
export function keywordTargetSpecs(ctx: ScriptCtx, abilityRef: string, self: InstanceId): readonly TargetSpec[] {
  const kt = keywordTriggerEntry(abilityRef);
  return kt?.targets ? kt.targets(ctx, self) : [];
}

/** The `TriggerDef` behind a `#kw:<keyword>` ability ref, or undefined for any other ref. */
export function keywordTriggerDef(abilityRef: string): TriggerDef | undefined {
  const at = abilityRef.indexOf('#kw:');
  if (at < 0) return undefined;
  const keyword = abilityRef.slice(at + 4);
  const kt = KEYWORD_TRIGGERS.get(keyword);
  if (!kt) return undefined;
  return {
    abilityId: `kw:${keyword}`,
    text: keyword,
    event: kt.event,
    // Resolution never asks the zone; persist and undying resolve from the graveyard.
    activeZones: ['battlefield', 'graveyard'],
    optional: kt.optional === true,
    ...(kt.looksBack ? { looksBack: true } : {}),
    matches: kt.matches,
    label: (ctx, self) => kt.label(ctx, self),
    resolve: kt.resolve,
  };
}
