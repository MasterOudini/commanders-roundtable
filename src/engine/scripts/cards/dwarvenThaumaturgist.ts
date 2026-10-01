// `Dwarven Thaumaturgist` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DWARVEN_THAUMATURGIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DWARVEN_THAUMATURGIST, "{T}: Switch target creature's power and toughness until end of turn.");

const VOCAB_A0 = vocabularyEffects("Switch target creature's power and toughness until end of turn.", DWARVEN_THAUMATURGIST.name);
const VOCAB_T_A0 = vocabularyTargets("Switch target creature's power and toughness until end of turn.");

export const DWARVEN_THAUMATURGIST_SCRIPT: CardScript = {
  oracleId: DWARVEN_THAUMATURGIST.oracleId,
  name: DWARVEN_THAUMATURGIST.name,
  activated: [
    {
      ref: `${DWARVEN_THAUMATURGIST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
