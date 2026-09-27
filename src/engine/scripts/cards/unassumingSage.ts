// `Unassuming Sage` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNASSUMING_SAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNASSUMING_SAGE, "When this creature enters, you may pay {2}. If you do, create a Sorcerer Role token attached to it. (Enchanted creature gets +1/+1 and has \"Whenever this creature attacks, scry 1.\")");

const VOCAB_L0 = vocabularyEffects("You may pay {2}. If you do, create a Sorcerer Role token attached to it.", UNASSUMING_SAGE.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}. If you do, create a Sorcerer Role token attached to it.");

export const UNASSUMING_SAGE_SCRIPT: CardScript = {
  oracleId: UNASSUMING_SAGE.oracleId,
  name: UNASSUMING_SAGE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Unassuming Sage - You may pay {2}. If you do, create a Sorcerer Role token attached to it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
