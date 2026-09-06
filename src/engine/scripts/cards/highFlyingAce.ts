// `High-Flying Ace` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HIGH_FLYING_ACE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HIGH_FLYING_ACE, "Flying\n{3}{W}: Target creature without flying gains flying until end of turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature without flying gains flying until end of turn.", HIGH_FLYING_ACE.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature without flying gains flying until end of turn.");

export const HIGH_FLYING_ACE_SCRIPT: CardScript = {
  oracleId: HIGH_FLYING_ACE.oracleId,
  name: HIGH_FLYING_ACE.name,
  activated: [
    {
      ref: `${HIGH_FLYING_ACE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
