// `Sarcomite Myr` - an activation pumping itself, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SARCOMITE_MYR } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SARCOMITE_MYR, "{2}: This creature gains flying until end of turn.\n{2}, Sacrifice this creature: Draw a card.");
const LINES = PRINTED.split('\n');

export const SARCOMITE_MYR_SCRIPT: CardScript = {
  oracleId: SARCOMITE_MYR.oracleId,
  name: SARCOMITE_MYR.name,
  activated: [
    {
      ref: `${SARCOMITE_MYR.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
    {
      ref: `${SARCOMITE_MYR.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
