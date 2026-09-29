// `Ahn-Crop Champion` - a exertAttack trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AHN_CROP_CHAMPION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AHN_CROP_CHAMPION, "You may exert this creature as it attacks. When you do, untap all other creatures you control. (An exerted creature won't untap during your next untap step.)");

const VOCAB_L0 = vocabularyEffects("Untap all other creatures you control.", AHN_CROP_CHAMPION.name);
const VOCAB_T_L0 = vocabularyTargets("Untap all other creatures you control.");

export const AHN_CROP_CHAMPION_SCRIPT: CardScript = {
  oracleId: AHN_CROP_CHAMPION.oracleId,
  name: AHN_CROP_CHAMPION.name,
  triggers: [
    {
      abilityId: 'exertAttack-0',
      text: PRINTED,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Ahn-Crop Champion - Untap all other creatures you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
