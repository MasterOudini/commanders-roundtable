// `Verduran Emissary` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VERDURAN_EMISSARY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VERDURAN_EMISSARY, "Kicker {1}{R} (You may pay an additional {1}{R} as you cast this spell.)\nWhen this creature enters, if it was kicked, destroy target artifact. It can't be regenerated.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy target artifact. It can't be regenerated.", VERDURAN_EMISSARY.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target artifact. It can't be regenerated.");

// "as long as it was kicked" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kicked ?? 0) > 0;
}


export const VERDURAN_EMISSARY_SCRIPT: CardScript = {
  oracleId: VERDURAN_EMISSARY.oracleId,
  name: VERDURAN_EMISSARY.name,
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
      label: () => "Verduran Emissary - Destroy target artifact. It can't be regenerated.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
