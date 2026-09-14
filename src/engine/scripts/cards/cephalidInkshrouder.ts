// `Cephalid Inkshrouder` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CEPHALID_INKSHROUDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CEPHALID_INKSHROUDER, "Discard a card: This creature gains shroud until end of turn and can't be blocked this turn. (A creature with shroud can't be the target of spells or abilities.)");

export const CEPHALID_INKSHROUDER_SCRIPT: CardScript = {
  oracleId: CEPHALID_INKSHROUDER.oracleId,
  name: CEPHALID_INKSHROUDER.name,
  activated: [
    {
      ref: `${CEPHALID_INKSHROUDER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["shroud"], cantBeBlocked: true }];
      },
    },
  ],
};
