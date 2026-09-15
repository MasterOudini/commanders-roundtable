// `Devoted Crop-Mate` - a exertAttack trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEVOTED_CROP_MATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEVOTED_CROP_MATE, "You may exert this creature as it attacks. When you do, return target creature card with mana value 2 or less from your graveyard to the battlefield. (An exerted creature won't untap during your next untap step.)");

const VOCAB_L0 = vocabularyEffects("Return target creature card with mana value 2 or less from your graveyard to the battlefield.", DEVOTED_CROP_MATE.name);
const VOCAB_T_L0 = vocabularyTargets("Return target creature card with mana value 2 or less from your graveyard to the battlefield.");

export const DEVOTED_CROP_MATE_SCRIPT: CardScript = {
  oracleId: DEVOTED_CROP_MATE.oracleId,
  name: DEVOTED_CROP_MATE.name,
  triggers: [
    {
      abilityId: 'exertAttack-0',
      text: PRINTED,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Devoted Crop-Mate - Return target creature card with mana value 2 or less from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
