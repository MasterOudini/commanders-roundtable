// `Priest of Fell Rites` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PRIEST_OF_FELL_RITES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PRIEST_OF_FELL_RITES, "{T}, Pay 3 life, Sacrifice this creature: Return target creature card from your graveyard to the battlefield. Activate only as a sorcery.\nUnearth {3}{W}{B} ({3}{W}{B}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return target creature card from your graveyard to the battlefield.", PRIEST_OF_FELL_RITES.name);
const VOCAB_T_A0 = vocabularyTargets("Return target creature card from your graveyard to the battlefield.");

export const PRIEST_OF_FELL_RITES_SCRIPT: CardScript = {
  oracleId: PRIEST_OF_FELL_RITES.oracleId,
  name: PRIEST_OF_FELL_RITES.name,
  activated: [
    {
      ref: `${PRIEST_OF_FELL_RITES.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
