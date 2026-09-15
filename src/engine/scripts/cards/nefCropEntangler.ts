// `Nef-Crop Entangler` - a exertAttack trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NEF_CROP_ENTANGLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NEF_CROP_ENTANGLER, "Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.)\nYou may exert this creature as it attacks. When you do, it gets +1/+2 until end of turn. (An exerted creature won't untap during your next untap step.)");
const LINES = PRINTED.split('\n');

export const NEF_CROP_ENTANGLER_SCRIPT: CardScript = {
  oracleId: NEF_CROP_ENTANGLER.oracleId,
  name: NEF_CROP_ENTANGLER.name,
  triggers: [
    {
      abilityId: 'exertAttack-1',
      text: LINES[1] as string,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Nef-Crop Entangler - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 2 }];
      },
    },
  ],
};
