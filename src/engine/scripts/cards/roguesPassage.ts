// `Rogue's Passage` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROGUE_S_PASSAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROGUE_S_PASSAGE, "{T}: Add {C}.\n{4}, {T}: Target creature can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target creature can't be blocked this turn.", ROGUE_S_PASSAGE.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature can't be blocked this turn.");

export const ROGUES_PASSAGE_SCRIPT: CardScript = {
  oracleId: ROGUE_S_PASSAGE.oracleId,
  name: ROGUE_S_PASSAGE.name,
  activated: [
    {
      ref: `${ROGUE_S_PASSAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
