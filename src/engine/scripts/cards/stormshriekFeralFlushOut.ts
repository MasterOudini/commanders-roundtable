// `Stormshriek Feral // Flush Out` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STORMSHRIEK_FERAL_FLUSH_OUT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(STORMSHRIEK_FERAL_FLUSH_OUT, "Flying, haste\n{1}{R}: This creature gets +1/+0 until end of turn.\nDiscard a card. If you do, draw two cards. (Then shuffle this card into its owner's library.)");
const LINES = PRINTED.split('\n');

export const STORMSHRIEK_FERAL_FLUSH_OUT_SCRIPT: CardScript = {
  oracleId: STORMSHRIEK_FERAL_FLUSH_OUT.oracleId,
  name: STORMSHRIEK_FERAL_FLUSH_OUT.name,
  activated: [
    {
      ref: `${STORMSHRIEK_FERAL_FLUSH_OUT.oracleId}#a0`, face: 0,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
