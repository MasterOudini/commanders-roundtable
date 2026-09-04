// `Moonglove Changeling` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOONGLOVE_CHANGELING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOONGLOVE_CHANGELING, "Changeling (This card is every creature type.)\n{B}: This creature gains deathtouch until end of turn. (Any amount of damage it deals to a creature is enough to destroy that creature.)");
const LINES = PRINTED.split('\n');

export const MOONGLOVE_CHANGELING_SCRIPT: CardScript = {
  oracleId: MOONGLOVE_CHANGELING.oracleId,
  name: MOONGLOVE_CHANGELING.name,
  activated: [
    {
      ref: `${MOONGLOVE_CHANGELING.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
  ],
};
