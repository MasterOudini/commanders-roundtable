// `Rhet-Crop Spearmaster` - a exertAttack trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RHET_CROP_SPEARMASTER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(RHET_CROP_SPEARMASTER, "You may exert this creature as it attacks. When you do, it gets +1/+0 and gains first strike until end of turn. (An exerted creature won't untap during your next untap step.)");

export const RHET_CROP_SPEARMASTER_SCRIPT: CardScript = {
  oracleId: RHET_CROP_SPEARMASTER.oracleId,
  name: RHET_CROP_SPEARMASTER.name,
  triggers: [
    {
      abilityId: 'exertAttack-0',
      text: PRINTED,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Rhet-Crop Spearmaster - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
