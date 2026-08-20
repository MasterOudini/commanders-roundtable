// `Alabaster Mage` — "{1}{W}: Target creature you control gains lifelink
// until end of turn." D194's rider on a repeatable activated grant. D197.

import { ALABASTER_MAGE } from '../../../data/fixtures/engineCards';
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
  ALABASTER_MAGE,
  '{1}{W}: Target creature you control gains lifelink until end of turn. (Damage dealt by the creature also causes its controller to gain that much life.)',
);

export const ALABASTER_MAGE_SCRIPT: CardScript = {
  oracleId: ALABASTER_MAGE.oracleId,
  name: ALABASTER_MAGE.name,
  activated: [
    {
      ref: `${ALABASTER_MAGE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['lifelink'] },
        ];
      },
    },
  ],
};
