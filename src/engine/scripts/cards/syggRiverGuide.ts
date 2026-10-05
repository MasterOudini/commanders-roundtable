// `Sygg, River Guide` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SYGG_RIVER_GUIDE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(SYGG_RIVER_GUIDE, "Islandwalk (This creature can't be blocked as long as defending player controls an Island.)\n{1}{W}: Target Merfolk you control gains protection from the color of your choice until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target Merfolk you control gains protection from the color of your choice until end of turn.", SYGG_RIVER_GUIDE.name);
const VOCAB_T_A0 = vocabularyTargets("Target Merfolk you control gains protection from the color of your choice until end of turn.");

export const SYGG_RIVER_GUIDE_SCRIPT: CardScript = {
  oracleId: SYGG_RIVER_GUIDE.oracleId,
  name: SYGG_RIVER_GUIDE.name,
  activated: [
    {
      ref: `${SYGG_RIVER_GUIDE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
