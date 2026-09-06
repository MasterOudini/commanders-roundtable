// `Professor Zei, Anthropologist` - an activation draw, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROFESSOR_ZEI_ANTHROPOLOGIST } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(PROFESSOR_ZEI_ANTHROPOLOGIST, "{T}, Discard a card: Draw a card.\n{1}, {T}, Sacrifice Professor Zei: Return target instant or sorcery card from your graveyard to your hand. Activate only during your turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Return target instant or sorcery card from your graveyard to your hand.", PROFESSOR_ZEI_ANTHROPOLOGIST.name);
const VOCAB_T_A1 = vocabularyTargets("Return target instant or sorcery card from your graveyard to your hand.");

export const PROFESSOR_ZEI_ANTHROPOLOGIST_SCRIPT: CardScript = {
  oracleId: PROFESSOR_ZEI_ANTHROPOLOGIST.oracleId,
  name: PROFESSOR_ZEI_ANTHROPOLOGIST.name,
  activated: [
    {
      ref: `${PROFESSOR_ZEI_ANTHROPOLOGIST.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      ref: `${PROFESSOR_ZEI_ANTHROPOLOGIST.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
