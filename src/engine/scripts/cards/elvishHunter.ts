// `Elvish Hunter` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELVISH_HUNTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELVISH_HUNTER, "{1}{G}, {T}: Target creature doesn't untap during its controller's next untap step.");

const VOCAB_A0 = vocabularyEffects("Target creature doesn't untap during its controller's next untap step.", ELVISH_HUNTER.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature doesn't untap during its controller's next untap step.");

export const ELVISH_HUNTER_SCRIPT: CardScript = {
  oracleId: ELVISH_HUNTER.oracleId,
  name: ELVISH_HUNTER.name,
  activated: [
    {
      ref: `${ELVISH_HUNTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
