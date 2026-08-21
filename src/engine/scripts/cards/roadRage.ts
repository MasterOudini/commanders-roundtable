// `Road Rage` — "Road Rage deals X damage to target creature or
// planeswalker, where X is 2 plus the number of Mounts and Vehicles you
// control." The subtype census burn — Mount and Vehicle are both
// SUBTYPES, read derived. D241.

import { ROAD_RAGE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  ROAD_RAGE,
  'Road Rage deals X damage to target creature or planeswalker, where X is 2 plus the number of Mounts and Vehicles you control.',
);

export const ROAD_RAGE_SCRIPT: CardScript = {
  oracleId: ROAD_RAGE.oracleId,
  name: ROAD_RAGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let rides = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const subtypes = ctx.derive(id).typeLine.subtypes;
        if (subtypes.includes('Mount') || subtypes.includes('Vehicle')) rides++;
      }
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: 2 + rides,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
    },
  },
};
