// `Blessed Hippogriff // Tyr's Blessing` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLESSED_HIPPOGRIFF_TYR_S_BLESSING } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(BLESSED_HIPPOGRIFF_TYR_S_BLESSING, "Flying\nWhenever this creature attacks, target attacking creature without flying gains flying until end of turn.\nTarget creature gains indestructible until end of turn. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target attacking creature without flying gains flying until end of turn.", BLESSED_HIPPOGRIFF_TYR_S_BLESSING.name);
const VOCAB_T_L1 = vocabularyTargets("Target attacking creature without flying gains flying until end of turn.");

export const BLESSED_HIPPOGRIFF_TYRS_BLESSING_SCRIPT: CardScript = {
  oracleId: BLESSED_HIPPOGRIFF_TYR_S_BLESSING.oracleId,
  name: BLESSED_HIPPOGRIFF_TYR_S_BLESSING.name,
  triggers: [
    {
      abilityId: 'attacks-1', face: 0,
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Blessed Hippogriff // Tyr's Blessing - Target attacking creature without flying gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
