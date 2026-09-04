// `Inkrise Infiltrator` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { INKRISE_INFILTRATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INKRISE_INFILTRATOR, "Flying\n{3}{B}: This creature gets +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const INKRISE_INFILTRATOR_SCRIPT: CardScript = {
  oracleId: INKRISE_INFILTRATOR.oracleId,
  name: INKRISE_INFILTRATOR.name,
  activated: [
    {
      ref: `${INKRISE_INFILTRATOR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
  ],
};
