// `Selfless Savior` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SELFLESS_SAVIOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SELFLESS_SAVIOR, "Sacrifice this creature: Another target creature you control gains indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy it.)");

const VOCAB_A0 = vocabularyEffects("Another target creature you control gains indestructible until end of turn.", SELFLESS_SAVIOR.name);
const VOCAB_T_A0 = vocabularyTargets("Another target creature you control gains indestructible until end of turn.");

export const SELFLESS_SAVIOR_SCRIPT: CardScript = {
  oracleId: SELFLESS_SAVIOR.oracleId,
  name: SELFLESS_SAVIOR.name,
  activated: [
    {
      ref: `${SELFLESS_SAVIOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
