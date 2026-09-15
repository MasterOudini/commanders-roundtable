// `Frenzied Arynx` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FRENZIED_ARYNX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FRENZIED_ARYNX, "Riot (This creature enters with your choice of a +1/+1 counter or haste.)\nTrample\n{4}{R}{G}: This creature gets +3/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const FRENZIED_ARYNX_SCRIPT: CardScript = {
  oracleId: FRENZIED_ARYNX.oracleId,
  name: FRENZIED_ARYNX.name,
  activated: [
    {
      ref: `${FRENZIED_ARYNX.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 3, toughness: 0 }];
      },
    },
  ],
};
