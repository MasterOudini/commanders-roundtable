// `Vineshaper Prodigy` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VINESHAPER_PRODIGY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VINESHAPER_PRODIGY, "Kicker {1}{U} (You may pay an additional {1}{U} as you cast this spell.)\nWhen this creature enters, if it was kicked, look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.", VINESHAPER_PRODIGY.name);
const VOCAB_T_L1 = vocabularyTargets("Look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.");

// "as long as it was kicked" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kicked ?? 0) > 0;
}


export const VINESHAPER_PRODIGY_SCRIPT: CardScript = {
  oracleId: VINESHAPER_PRODIGY.oracleId,
  name: VINESHAPER_PRODIGY.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Vineshaper Prodigy - Look at the top three cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
