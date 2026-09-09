// `Scornful Aether-Lich` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCORNFUL_AETHER_LICH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCORNFUL_AETHER_LICH, "{W}{B}: This creature gains fear and vigilance until end of turn. (Attacking doesn't cause it to tap, and it can't be blocked except by artifact creatures and/or black creatures.)");

export const SCORNFUL_AETHER_LICH_SCRIPT: CardScript = {
  oracleId: SCORNFUL_AETHER_LICH.oracleId,
  name: SCORNFUL_AETHER_LICH.name,
  activated: [
    {
      ref: `${SCORNFUL_AETHER_LICH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["fear", "vigilance"] }];
      },
    },
  ],
};
