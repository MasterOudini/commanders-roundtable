// `Ipnu Rivulet` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IPNU_RIVULET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IPNU_RIVULET, "{T}: Add {C}.\n{T}, Pay 1 life: Add {U}.\n{1}{U}, {T}, Sacrifice a Desert: Target player mills four cards. (They put the top four cards of their library into their graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_A2 = vocabularyEffects("Target player mills four cards.", IPNU_RIVULET.name);
const VOCAB_T_A2 = vocabularyTargets("Target player mills four cards.");

export const IPNU_RIVULET_SCRIPT: CardScript = {
  oracleId: IPNU_RIVULET.oracleId,
  name: IPNU_RIVULET.name,
  activated: [
    {
      ref: `${IPNU_RIVULET.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
