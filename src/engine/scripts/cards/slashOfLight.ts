// `Slash of Light` — "Slash of Light deals damage equal to the number of
// creatures you control plus the number of Equipment you control to target
// creature." Misthios's Fury's Equipment census summed with a creature
// count, both off the derived type line. D248.

import { SLASH_OF_LIGHT } from '../../../data/fixtures/engineCards';
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
  SLASH_OF_LIGHT,
  'Slash of Light deals damage equal to the number of creatures you control plus the number of Equipment you control to target creature.',
);

export const SLASH_OF_LIGHT_SCRIPT: CardScript = {
  oracleId: SLASH_OF_LIGHT.oracleId,
  name: SLASH_OF_LIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let amount = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (d.typeLine.types.includes('Creature')) amount += 1;
        if (d.typeLine.subtypes.includes('Equipment')) amount += 1;
      }
      if (amount <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount,
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
