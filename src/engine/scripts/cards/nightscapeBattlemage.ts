// `Nightscape Battlemage` - a etb trigger vocab, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIGHTSCAPE_BATTLEMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIGHTSCAPE_BATTLEMAGE, "Kicker {2}{U} and/or {2}{R} (You may pay an additional {2}{U} and/or {2}{R} as you cast this spell.)\nWhen this creature enters, if it was kicked with its {2}{U} kicker, return up to two target nonblack creatures to their owners' hands.\nWhen this creature enters, if it was kicked with its {2}{R} kicker, destroy target land.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return up to two target nonblack creatures to their owners' hands.", NIGHTSCAPE_BATTLEMAGE.name);
const VOCAB_T_L1 = vocabularyTargets("Return up to two target nonblack creatures to their owners' hands.");
const VOCAB_L2 = vocabularyEffects("Destroy target land.", NIGHTSCAPE_BATTLEMAGE.name);
const VOCAB_T_L2 = vocabularyTargets("Destroy target land.");

// "as long as it was kicked with its {2}{U} kicker" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kickedWith ?? []).includes(0);
}

// "as long as it was kicked with its {2}{R} kicker" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kickedWith ?? []).includes(1);
}


export const NIGHTSCAPE_BATTLEMAGE_SCRIPT: CardScript = {
  oracleId: NIGHTSCAPE_BATTLEMAGE.oracleId,
  name: NIGHTSCAPE_BATTLEMAGE.name,
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
      label: () => "Nightscape Battlemage - Return up to two target nonblack creatures to their owners' hands.",
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
      label: () => "Nightscape Battlemage - Destroy target land.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
