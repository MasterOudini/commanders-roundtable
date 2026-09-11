// `Orzhov Keyrune` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORZHOV_KEYRUNE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORZHOV_KEYRUNE, "{T}: Add {W} or {B}.\n{W}{B}: This artifact becomes a 1/4 white and black Thrull artifact creature with lifelink until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 1/4 white and black Thrull artifact creature with lifelink until end of turn.", ORZHOV_KEYRUNE.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 1/4 white and black Thrull artifact creature with lifelink until end of turn.");

export const ORZHOV_KEYRUNE_SCRIPT: CardScript = {
  oracleId: ORZHOV_KEYRUNE.oracleId,
  name: ORZHOV_KEYRUNE.name,
  activated: [
    {
      ref: `${ORZHOV_KEYRUNE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
