// `Elephant Graveyard` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELEPHANT_GRAVEYARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELEPHANT_GRAVEYARD, "{T}: Add {C}.\n{T}: Regenerate target Elephant.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Regenerate target Elephant.", ELEPHANT_GRAVEYARD.name);
const VOCAB_T_A1 = vocabularyTargets("Regenerate target Elephant.");

export const ELEPHANT_GRAVEYARD_SCRIPT: CardScript = {
  oracleId: ELEPHANT_GRAVEYARD.oracleId,
  name: ELEPHANT_GRAVEYARD.name,
  activated: [
    {
      ref: `${ELEPHANT_GRAVEYARD.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
