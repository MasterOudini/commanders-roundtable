// `Thunderscape Battlemage` - a etb trigger vocab, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THUNDERSCAPE_BATTLEMAGE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(THUNDERSCAPE_BATTLEMAGE, "Kicker {1}{B} and/or {G} (You may pay an additional {1}{B} and/or {G} as you cast this spell.)\nWhen this creature enters, if it was kicked with its {1}{B} kicker, target player discards two cards.\nWhen this creature enters, if it was kicked with its {G} kicker, destroy target enchantment.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player discards two cards.", THUNDERSCAPE_BATTLEMAGE.name);
const VOCAB_T_L1 = vocabularyTargets("Target player discards two cards.");
const VOCAB_L2 = vocabularyEffects("Destroy target enchantment.", THUNDERSCAPE_BATTLEMAGE.name);
const VOCAB_T_L2 = vocabularyTargets("Destroy target enchantment.");

// "as long as it was kicked with its {1}{B} kicker" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kickedWith ?? []).includes(0);
}

// "as long as it was kicked with its {G} kicker" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kickedWith ?? []).includes(1);
}


export const THUNDERSCAPE_BATTLEMAGE_SCRIPT: CardScript = {
  oracleId: THUNDERSCAPE_BATTLEMAGE.oracleId,
  name: THUNDERSCAPE_BATTLEMAGE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Thunderscape Battlemage - Target player discards two cards.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) =>
        ifCond2Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Thunderscape Battlemage - Destroy target enchantment.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
