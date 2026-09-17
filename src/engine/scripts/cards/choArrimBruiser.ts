// `Cho-Arrim Bruiser` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHO_ARRIM_BRUISER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHO_ARRIM_BRUISER, "Whenever this creature attacks, you may tap up to two target creatures.");

const VOCAB_L0 = vocabularyEffects("Tap up to two target creatures.", CHO_ARRIM_BRUISER.name);
const VOCAB_T_L0 = vocabularyTargets("Tap up to two target creatures.");

export const CHO_ARRIM_BRUISER_SCRIPT: CardScript = {
  oracleId: CHO_ARRIM_BRUISER.oracleId,
  name: CHO_ARRIM_BRUISER.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Cho-Arrim Bruiser - Tap up to two target creatures.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
