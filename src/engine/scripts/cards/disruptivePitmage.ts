// `Disruptive Pitmage` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DISRUPTIVE_PITMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DISRUPTIVE_PITMAGE, "{T}: Counter target spell unless its controller pays {1}.\nMorph {U} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Counter target spell unless its controller pays {1}.", DISRUPTIVE_PITMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Counter target spell unless its controller pays {1}.");

export const DISRUPTIVE_PITMAGE_SCRIPT: CardScript = {
  oracleId: DISRUPTIVE_PITMAGE.oracleId,
  name: DISRUPTIVE_PITMAGE.name,
  activated: [
    {
      ref: `${DISRUPTIVE_PITMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
