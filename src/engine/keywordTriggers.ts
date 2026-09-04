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

import type { ScriptCtx, TriggerDef } from './scripts/api';
import type { EventBody, EventKind } from './types/events';
import type { InstanceId } from './types/ids';
import type { Keyword } from './types/oracle';
import type { StackObject } from './types/state';
import { faceOf } from './oracle';

export interface KeywordTrigger {
  readonly event: EventKind;
  readonly looksBack?: boolean;
  matches(ctx: ScriptCtx, self: InstanceId, ev: EventBody): boolean;
  /** The item each firing carries (`obj.item`): the lone attacker, the blocker, the entering creature. */
  perItem?(ctx: ScriptCtx, self: InstanceId, ev: EventBody): readonly InstanceId[];
  label(ctx: ScriptCtx, self: InstanceId): string;
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
    optional: false,
    ...(kt.looksBack ? { looksBack: true } : {}),
    matches: kt.matches,
    label: (ctx, self) => kt.label(ctx, self),
    resolve: kt.resolve,
  };
}
