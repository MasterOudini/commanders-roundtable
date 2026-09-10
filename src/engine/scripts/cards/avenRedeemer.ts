// `Aven Redeemer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVEN_REDEEMER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVEN_REDEEMER, "Flying\n{T}: Prevent the next 2 damage that would be dealt to any target this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Prevent the next 2 damage that would be dealt to any target this turn.", AVEN_REDEEMER.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 2 damage that would be dealt to any target this turn.");

export const AVEN_REDEEMER_SCRIPT: CardScript = {
  oracleId: AVEN_REDEEMER.oracleId,
  name: AVEN_REDEEMER.name,
  activated: [
    {
      ref: `${AVEN_REDEEMER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
