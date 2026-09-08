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
import { TOKEN_TABLE, type TokenRef } from '../data/tokenTable';
import type { ScriptCtx, TriggerDef } from './scripts/api';
import type { EventBody, EventKind } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import type { Keyword, TargetSpec } from './types/oracle';
import type { DefenderRef, StackObject } from './types/state';
import { faceOf } from './oracle';

export interface KeywordTrigger {
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
  resolve(ctx: ScriptCtx, self: InstanceId, obj: StackObject): readonly EventBody[];
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
const isCreature = (ctx: ScriptCtx, id: InstanceId): boolean => ctx.derive(id).typeLine.types.includes('Creature');

export const KEYWORD_TRIGGERS: ReadonlyMap<Keyword, KeywordTrigger> = new Map<Keyword, KeywordTrigger>([
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
]);

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
  return KEYWORD_TRIGGERS.get(abilityRef.slice(at + 4) as Keyword);
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
  const keyword = abilityRef.slice(at + 4) as Keyword;
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
