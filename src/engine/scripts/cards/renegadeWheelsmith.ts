// `Renegade Wheelsmith` - a becomesTapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RENEGADE_WHEELSMITH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(RENEGADE_WHEELSMITH, "Whenever this creature becomes tapped, target creature can't block this turn.");

const VOCAB_L0 = vocabularyEffects("Target creature can't block this turn.", RENEGADE_WHEELSMITH.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature can't block this turn.");

export const RENEGADE_WHEELSMITH_SCRIPT: CardScript = {
  oracleId: RENEGADE_WHEELSMITH.oracleId,
  name: RENEGADE_WHEELSMITH.name,
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: PRINTED,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Renegade Wheelsmith - Target creature can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
