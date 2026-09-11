// `Guardian Idol` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GUARDIAN_IDOL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GUARDIAN_IDOL, "This artifact enters tapped.\n{T}: Add {C}.\n{2}: This artifact becomes a 2/2 Golem artifact creature until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 2/2 Golem artifact creature until end of turn.", GUARDIAN_IDOL.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 2/2 Golem artifact creature until end of turn.");

export const GUARDIAN_IDOL_SCRIPT: CardScript = {
  oracleId: GUARDIAN_IDOL.oracleId,
  name: GUARDIAN_IDOL.name,
  activated: [
    {
      ref: `${GUARDIAN_IDOL.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
