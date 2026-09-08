// `Icebind Pillar` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ICEBIND_PILLAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ICEBIND_PILLAR, "{S}, {T}: Tap target artifact or creature. ({S} can be paid with one mana from a snow source.)");

const VOCAB_A0 = vocabularyEffects("Tap target artifact or creature.", ICEBIND_PILLAR.name);
const VOCAB_T_A0 = vocabularyTargets("Tap target artifact or creature.");

export const ICEBIND_PILLAR_SCRIPT: CardScript = {
  oracleId: ICEBIND_PILLAR.oracleId,
  name: ICEBIND_PILLAR.name,
  activated: [
    {
      ref: `${ICEBIND_PILLAR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
