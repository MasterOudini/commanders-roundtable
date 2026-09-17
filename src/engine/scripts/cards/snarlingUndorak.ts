// `Snarling Undorak` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SNARLING_UNDORAK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SNARLING_UNDORAK, "{2}{G}: Target Beast creature gets +1/+1 until end of turn.\nMorph {1}{G}{G} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target Beast creature gets +1/+1 until end of turn.", SNARLING_UNDORAK.name);
const VOCAB_T_A0 = vocabularyTargets("Target Beast creature gets +1/+1 until end of turn.");

export const SNARLING_UNDORAK_SCRIPT: CardScript = {
  oracleId: SNARLING_UNDORAK.oracleId,
  name: SNARLING_UNDORAK.name,
  activated: [
    {
      ref: `${SNARLING_UNDORAK.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
