// `Nullpriest of Oblivion` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NULLPRIEST_OF_OBLIVION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NULLPRIEST_OF_OBLIVION, "Kicker {3}{B} (You may pay an additional {3}{B} as you cast this spell.)\nLifelink\nMenace (This creature can't be blocked except by two or more creatures.)\nWhen this creature enters, if it was kicked, return target creature card from your graveyard to the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L3 = vocabularyEffects("Return target creature card from your graveyard to the battlefield.", NULLPRIEST_OF_OBLIVION.name);
const VOCAB_T_L3 = vocabularyTargets("Return target creature card from your graveyard to the battlefield.");

// "as long as it was kicked" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond3Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kicked ?? 0) > 0;
}


export const NULLPRIEST_OF_OBLIVION_SCRIPT: CardScript = {
  oracleId: NULLPRIEST_OF_OBLIVION.oracleId,
  name: NULLPRIEST_OF_OBLIVION.name,
  triggers: [
    {
      abilityId: 'etb-3',
      text: LINES[3] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L3,
      matches: (ctx, self, ev) =>
        ifCond3Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Nullpriest of Oblivion - Return target creature card from your graveyard to the battlefield.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond3Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
