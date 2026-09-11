// `Darksteel Brute` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DARKSTEEL_BRUTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DARKSTEEL_BRUTE, "Indestructible (Damage and effects that say \"destroy\" don't destroy this artifact.)\n{3}: This artifact becomes a 2/2 Beast artifact creature until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ becomes a 2/2 Beast artifact creature until end of turn.", DARKSTEEL_BRUTE.name);
const VOCAB_T_A0 = vocabularyTargets("~ becomes a 2/2 Beast artifact creature until end of turn.");

export const DARKSTEEL_BRUTE_SCRIPT: CardScript = {
  oracleId: DARKSTEEL_BRUTE.oracleId,
  name: DARKSTEEL_BRUTE.name,
  activated: [
    {
      ref: `${DARKSTEEL_BRUTE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
