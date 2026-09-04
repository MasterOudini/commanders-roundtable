// `Gnathosaur` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GNATHOSAUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GNATHOSAUR, "Sacrifice an artifact: This creature gains trample until end of turn.");

export const GNATHOSAUR_SCRIPT: CardScript = {
  oracleId: GNATHOSAUR.oracleId,
  name: GNATHOSAUR.name,
  activated: [
    {
      ref: `${GNATHOSAUR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["trample"] }];
      },
    },
  ],
};
