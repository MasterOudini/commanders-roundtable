// `Unrooted Ancestor` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNROOTED_ANCESTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNROOTED_ANCESTOR, "Flash\n{1}, Sacrifice another creature: This creature gains indestructible until end of turn. Tap it. (Damage and effects that say \"destroy\" don't destroy it.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gains indestructible until end of turn. Tap it.", UNROOTED_ANCESTOR.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains indestructible until end of turn. Tap it.");

export const UNROOTED_ANCESTOR_SCRIPT: CardScript = {
  oracleId: UNROOTED_ANCESTOR.oracleId,
  name: UNROOTED_ANCESTOR.name,
  activated: [
    {
      ref: `${UNROOTED_ANCESTOR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
