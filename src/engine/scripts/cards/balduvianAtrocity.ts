// `Balduvian Atrocity` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BALDUVIAN_ATROCITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BALDUVIAN_ATROCITY, "Kicker {R} (You may pay an additional {R} as you cast this spell.)\nMenace\nWhen this creature enters, if it was kicked, return target creature card with mana value 3 or less from your graveyard to the battlefield. It gains haste. Sacrifice it at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Return target creature card with mana value 3 or less from your graveyard to the battlefield. It gains haste. Sacrifice it at the beginning of the next end step.", BALDUVIAN_ATROCITY.name);
const VOCAB_T_L2 = vocabularyTargets("Return target creature card with mana value 3 or less from your graveyard to the battlefield. It gains haste. Sacrifice it at the beginning of the next end step.");

// "as long as it was kicked" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kicked ?? 0) > 0;
}


export const BALDUVIAN_ATROCITY_SCRIPT: CardScript = {
  oracleId: BALDUVIAN_ATROCITY.oracleId,
  name: BALDUVIAN_ATROCITY.name,
  triggers: [
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
      label: () => "Balduvian Atrocity - Return target creature card with mana value 3 or less from your graveyard to the battlefield. It gains haste. Sacrifice it at the beginning of the next end step.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
