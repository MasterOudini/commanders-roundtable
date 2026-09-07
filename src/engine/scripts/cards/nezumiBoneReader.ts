// `Nezumi Bone-Reader` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NEZUMI_BONE_READER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NEZUMI_BONE_READER, "{B}, Sacrifice a creature: Target player discards a card. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Target player discards a card.", NEZUMI_BONE_READER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player discards a card.");

export const NEZUMI_BONE_READER_SCRIPT: CardScript = {
  oracleId: NEZUMI_BONE_READER.oracleId,
  name: NEZUMI_BONE_READER.name,
  activated: [
    {
      ref: `${NEZUMI_BONE_READER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
