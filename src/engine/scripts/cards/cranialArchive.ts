// `Cranial Archive` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRANIAL_ARCHIVE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRANIAL_ARCHIVE, "{2}, Exile this artifact: Target player shuffles their graveyard into their library. Draw a card.");

const VOCAB_A0 = vocabularyEffects("Target player shuffles their graveyard into their library. Draw a card.", CRANIAL_ARCHIVE.name);
const VOCAB_T_A0 = vocabularyTargets("Target player shuffles their graveyard into their library. Draw a card.");

export const CRANIAL_ARCHIVE_SCRIPT: CardScript = {
  oracleId: CRANIAL_ARCHIVE.oracleId,
  name: CRANIAL_ARCHIVE.name,
  activated: [
    {
      ref: `${CRANIAL_ARCHIVE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
