// `Aphetto Alchemist` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APHETTO_ALCHEMIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APHETTO_ALCHEMIST, "{T}: Untap target artifact or creature.\nMorph {U} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Untap target artifact or creature.", APHETTO_ALCHEMIST.name);
const VOCAB_T_A0 = vocabularyTargets("Untap target artifact or creature.");

export const APHETTO_ALCHEMIST_SCRIPT: CardScript = {
  oracleId: APHETTO_ALCHEMIST.oracleId,
  name: APHETTO_ALCHEMIST.name,
  activated: [
    {
      ref: `${APHETTO_ALCHEMIST.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
