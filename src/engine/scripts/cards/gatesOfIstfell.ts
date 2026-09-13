// `Gates of Istfell` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GATES_OF_ISTFELL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GATES_OF_ISTFELL, "This land enters tapped.\n{T}: Add {W}.\n{2}{W}{U}{U}, {T}, Sacrifice this land: You gain 2 life and draw two cards.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("You gain 2 life and draw two cards.", GATES_OF_ISTFELL.name);
const VOCAB_T_A1 = vocabularyTargets("You gain 2 life and draw two cards.");

export const GATES_OF_ISTFELL_SCRIPT: CardScript = {
  oracleId: GATES_OF_ISTFELL.oracleId,
  name: GATES_OF_ISTFELL.name,
  activated: [
    {
      ref: `${GATES_OF_ISTFELL.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
