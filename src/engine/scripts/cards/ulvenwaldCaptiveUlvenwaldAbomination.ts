// `Ulvenwald Captive // Ulvenwald Abomination` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ULVENWALD_CAPTIVE_ULVENWALD_ABOMINATION } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(ULVENWALD_CAPTIVE_ULVENWALD_ABOMINATION, "Defender\n{T}: Add {G}.\n{5}{G}{G}: Transform this creature.\n{T}: Add {C}{C}.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = transformFrom(vocabularyEffects("Transform this creature.", ULVENWALD_CAPTIVE_ULVENWALD_ABOMINATION.name), 0);
const VOCAB_T_A1 = vocabularyTargets("Transform this creature.");

export const ULVENWALD_CAPTIVE_ULVENWALD_ABOMINATION_SCRIPT: CardScript = {
  oracleId: ULVENWALD_CAPTIVE_ULVENWALD_ABOMINATION.oracleId,
  name: ULVENWALD_CAPTIVE_ULVENWALD_ABOMINATION.name,
  activated: [
    {
      ref: `${ULVENWALD_CAPTIVE_ULVENWALD_ABOMINATION.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
