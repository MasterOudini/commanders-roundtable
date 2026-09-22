// D521 - THE RING (CR 701.54): the emblem the first temptation gives, in its owner's command zone (D475's rule - an
// emblem's abilities run from there). Its four printed abilities unlock one per temptation. The first (the Ring-bearer
// is legendary and can't be blocked by creatures with greater power) is the ENGINE's own - `derive` adds the supertype
// at layer 4 and `combat.ts`'s `canBlock` refuses the block - because a static that rewrites another object's types
// and a blocking restriction are not a script's to grant; the three triggers below are the emblem's, each gated on the
// seat's count. The Ring-bearer is read off the seat (`players[p].ringBearer`), never off the emblem, so the object
// and the count cannot disagree; a temptation with no creature leaves the triggers silent.
import { THE_RING_THE_RING_TEMPTS_YOU } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';
import type { EffectSpec } from '../../types/oracle';
import type { DelayedTrigger } from '../../types/state';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(
  THE_RING_THE_RING_TEMPTS_YOU,
  "Your Ring-bearer is legendary and can't be blocked by creatures with greater power.\nWhenever your Ring-bearer attacks, draw a card, then discard a card.\nWhenever your Ring-bearer becomes blocked by a creature, that creature's controller sacrifices it at end of combat.\nWhenever your Ring-bearer deals combat damage to a player, each opponent loses 3 life.",
);
const LINES = PRINTED.split('\n');

const VOCAB_LOOT = vocabularyEffects('Draw a card, then discard a card.', 'The Ring');
const VOCAB_DRAIN = vocabularyEffects('Each opponent loses 3 life.', 'The Ring');
// The delayed sacrifice of the blocker: the vocabulary's own `sacrificeObj` (D494's carrier), read from the one form it
// prints (a delayed verb over the previous clause's objects), unbound from that clause and aimed at the fire's first aim
// - the executor's own arming, done here because the trigger's object is the EVENT's blocker, not a clause's.
const SAC_AT_END_OF_COMBAT: EffectSpec = (() => {
  const parsed = vocabularyEffects('Create a 1/1 white Soldier creature token. Sacrifice it at end of combat.', 'The Ring');
  const delayed = parsed[1];
  if (!delayed || delayed.kind !== 'sacrificeObj' || !delayed.delay) throw new Error('The Ring: the delayed sacrifice form is no longer read (D521)');
  const rest: Record<string, unknown> = { ...delayed };
  delete rest['ofPrevious'];
  return { ...(rest as unknown as EffectSpec), delay: null, targetIndex: 0 };
})();

const seatOf = (ctx: ScriptCtx, self: InstanceId) => {
  const p = ctx.query.controllerOf(self);
  return p === null ? null : (ctx.state.players[p] ?? null);
};
const bearerOf = (ctx: ScriptCtx, self: InstanceId): InstanceId | null => seatOf(ctx, self)?.ringBearer ?? null;
const level = (ctx: ScriptCtx, self: InstanceId): number => seatOf(ctx, self)?.ringTempts ?? 0;

export const THE_RING_SCRIPT: CardScript = {
  oracleId: THE_RING_THE_RING_TEMPTS_YOU.oracleId,
  name: 'The Ring',
  triggers: [
    {
      abilityId: 'ring-2',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['command'],
      optional: false,
      matches: (ctx, self, ev) => {
        const bearer = bearerOf(ctx, self);
        return ev.t === 'AttackersDeclared' && level(ctx, self) >= 2 && bearer !== null && ev.attackers.some((a) => a.card === bearer);
      },
      label: () => 'The Ring - Whenever your Ring-bearer attacks, draw a card, then discard a card.',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, VOCAB_LOOT, []),
    },
    {
      abilityId: 'ring-3',
      text: LINES[2] as string,
      event: 'BlockersDeclared',
      activeZones: ['command'],
      optional: false,
      perItem: (ctx, self, ev) => {
        const bearer = bearerOf(ctx, self);
        return ev.t === 'BlockersDeclared' && level(ctx, self) >= 3 && bearer !== null ? ev.blocks.filter((b) => b.attacker === bearer).map((b) => b.blocker) : [];
      },
      matches: (ctx, self, ev) => {
        const bearer = bearerOf(ctx, self);
        return ev.t === 'BlockersDeclared' && level(ctx, self) >= 3 && bearer !== null && ev.blocks.some((b) => b.attacker === bearer);
      },
      label: () => "The Ring - Whenever your Ring-bearer becomes blocked by a creature, that creature's controller sacrifices it at end of combat.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        const controller = ctx.query.controllerOf(self);
        if (controller === null) return [];
        const trigger: DelayedTrigger = {
          id: `${obj.id}-ring3-${obj.item}`,
          controller,
          source: self,
          when: { step: 'endCombat', whose: 'next' },
          armedTurn: ctx.state.turn.turnNumber,
          armedStep: ctx.state.turn.step,
          effects: [SAC_AT_END_OF_COMBAT],
          label: "The Ring - that creature's controller sacrifices it at end of combat",
          aims: [obj.item],
        };
        return [{ t: 'DelayedTriggerArmed', trigger }];
      },
    },
    {
      abilityId: 'ring-4',
      text: LINES[3] as string,
      event: 'CombatDamageDealt',
      activeZones: ['command'],
      optional: false,
      matches: (ctx, self, ev) => {
        const bearer = bearerOf(ctx, self);
        return ev.t === 'CombatDamageDealt' && level(ctx, self) >= 4 && bearer !== null && ev.damages.some((d) => d.source === bearer && d.target.kind === 'player' && d.amount > 0);
      },
      label: () => 'The Ring - Whenever your Ring-bearer deals combat damage to a player, each opponent loses 3 life.',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, VOCAB_DRAIN, []),
    },
  ],
};
