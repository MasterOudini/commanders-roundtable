// `Rhystic Deluge` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RHYSTIC_DELUGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RHYSTIC_DELUGE, "{U}: Tap target creature unless its controller pays {1}.");

const VOCAB_A0 = vocabularyEffects("Tap target creature unless its controller pays {1}.", RHYSTIC_DELUGE.name);
const VOCAB_T_A0 = vocabularyTargets("Tap target creature unless its controller pays {1}.");

export const RHYSTIC_DELUGE_SCRIPT: CardScript = {
  oracleId: RHYSTIC_DELUGE.oracleId,
  name: RHYSTIC_DELUGE.name,
  activated: [
    {
      ref: `${RHYSTIC_DELUGE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
