// `Frantic Firebolt` — "Frantic Firebolt deals X damage to target
// creature, where X is 2 plus the number of cards in your graveyard that
// are instant cards, sorcery cards, and/or have an Adventure." The census
// reads ORACLE faces for the types and the printing's layout for the
// Adventure (Edgewall's idiom); a card matching twice counts once. D214.

import { FRANTIC_FIREBOLT } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  FRANTIC_FIREBOLT,
  'Frantic Firebolt deals X damage to target creature, where X is 2 plus the number of cards in your graveyard that are instant cards, sorcery cards, and/or have an Adventure.',
);

export const FRANTIC_FIREBOLT_SCRIPT: CardScript = {
  oracleId: FRANTIC_FIREBOLT.oracleId,
  name: FRANTIC_FIREBOLT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let census = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        const types = faceOf(oc, card.faceIndex ?? 0).typeLine.types;
        if (types.includes('Instant') || types.includes('Sorcery') || oc.layout === 'adventure') {
          census++;
        }
      }
      const x = 2 + census;
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
