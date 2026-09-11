// `Hissing Quagmire` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HISSING_QUAGMIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HISSING_QUAGMIRE, "This land enters tapped.\n{T}: Add {B} or {G}.\n{1}{B}{G}: Until end of turn, this land becomes a 2/2 black and green Elemental creature with deathtouch. It's still a land.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Until end of turn, this land becomes a 2/2 black and green Elemental creature with deathtouch. It's still a land.", HISSING_QUAGMIRE.name);
const VOCAB_T_A1 = vocabularyTargets("Until end of turn, this land becomes a 2/2 black and green Elemental creature with deathtouch. It's still a land.");

export const HISSING_QUAGMIRE_SCRIPT: CardScript = {
  oracleId: HISSING_QUAGMIRE.oracleId,
  name: HISSING_QUAGMIRE.name,
  activated: [
    {
      ref: `${HISSING_QUAGMIRE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
