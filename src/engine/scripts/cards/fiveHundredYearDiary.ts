// `Five Hundred Year Diary` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIVE_HUNDRED_YEAR_DIARY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIVE_HUNDRED_YEAR_DIARY, "Five Hundred Year Diary enters tapped.\n{T}: Add {U} for each Clue you control.\n{2}, Sacrifice Five Hundred Year Diary: Draw a card.");
const LINES = PRINTED.split('\n');

export const FIVE_HUNDRED_YEAR_DIARY_SCRIPT: CardScript = {
  oracleId: FIVE_HUNDRED_YEAR_DIARY.oracleId,
  name: FIVE_HUNDRED_YEAR_DIARY.name,
  activated: [
    {
      ref: `${FIVE_HUNDRED_YEAR_DIARY.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
