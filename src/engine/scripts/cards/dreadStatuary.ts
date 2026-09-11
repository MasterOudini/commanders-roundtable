// `Dread Statuary` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREAD_STATUARY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREAD_STATUARY, "{T}: Add {C}.\n{4}: This land becomes a 4/2 Golem artifact creature until end of turn. It's still a land.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 4/2 Golem artifact creature until end of turn. It's still a land.", DREAD_STATUARY.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 4/2 Golem artifact creature until end of turn. It's still a land.");

export const DREAD_STATUARY_SCRIPT: CardScript = {
  oracleId: DREAD_STATUARY.oracleId,
  name: DREAD_STATUARY.name,
  activated: [
    {
      ref: `${DREAD_STATUARY.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
