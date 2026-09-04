// `Pitiless Pontiff` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { PITILESS_PONTIFF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PITILESS_PONTIFF, "{1}, Sacrifice another creature: This creature gains deathtouch and indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy it.)");

export const PITILESS_PONTIFF_SCRIPT: CardScript = {
  oracleId: PITILESS_PONTIFF.oracleId,
  name: PITILESS_PONTIFF.name,
  activated: [
    {
      ref: `${PITILESS_PONTIFF.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch", "indestructible"] }];
      },
    },
  ],
};
