// `Consuming Corruption` — "Consuming Corruption deals X damage to target
// creature or planeswalker and you gain X life, where X is the number of
// Swamps you control." D204.

import { CONSUMING_CORRUPTION } from '../../../data/fixtures/engineCards';
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
  CONSUMING_CORRUPTION,
  'Consuming Corruption deals X damage to target creature or planeswalker and you gain X life, where X is the number of Swamps you control.',
);

export const CONSUMING_CORRUPTION_SCRIPT: CardScript = {
  oracleId: CONSUMING_CORRUPTION.oracleId,
  name: CONSUMING_CORRUPTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Swamp')) x++;
      }
      if (x <= 0) return [];
      const life = ctx.state.players[obj.controller]?.life ?? 0;
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: x,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
        { t: 'LifeChanged', player: obj.controller, delta: x, to: life + x },
      ];
    },
  },
};
