// `Krosan Warchief` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KROSAN_WARCHIEF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KROSAN_WARCHIEF, "Beast spells you cast cost {1} less to cast.\n{1}{G}: Regenerate target Beast.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Regenerate target Beast.", KROSAN_WARCHIEF.name);
const VOCAB_T_A0 = vocabularyTargets("Regenerate target Beast.");

export const KROSAN_WARCHIEF_SCRIPT: CardScript = {
  oracleId: KROSAN_WARCHIEF.oracleId,
  name: KROSAN_WARCHIEF.name,
  activated: [
    {
      ref: `${KROSAN_WARCHIEF.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
