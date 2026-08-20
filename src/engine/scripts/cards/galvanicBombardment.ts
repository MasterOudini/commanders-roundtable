// `Galvanic Bombardment` — "Galvanic Bombardment deals X damage to target
// creature, where X is 2 plus the number of cards named Galvanic
// Bombardment in your graveyard." The self-name census over MY graveyard.
// D215.

import { GALVANIC_BOMBARDMENT } from '../../../data/fixtures/engineCards';
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
  GALVANIC_BOMBARDMENT,
  'Galvanic Bombardment deals X damage to target creature, where X is 2 plus the number of cards named Galvanic Bombardment in your graveyard.',
);

export const GALVANIC_BOMBARDMENT_SCRIPT: CardScript = {
  oracleId: GALVANIC_BOMBARDMENT.oracleId,
  name: GALVANIC_BOMBARDMENT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let named = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (ctx.oracle.byPrinting(card.printingId)?.name === 'Galvanic Bombardment') named++;
      }
      const x = 2 + named;
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
      ];
    },
  },
};
