// `Clockwork Gnomes` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLOCKWORK_GNOMES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLOCKWORK_GNOMES, "{3}, {T}: Regenerate target artifact creature.");

const VOCAB_A0 = vocabularyEffects("Regenerate target artifact creature.", CLOCKWORK_GNOMES.name);
const VOCAB_T_A0 = vocabularyTargets("Regenerate target artifact creature.");

export const CLOCKWORK_GNOMES_SCRIPT: CardScript = {
  oracleId: CLOCKWORK_GNOMES.oracleId,
  name: CLOCKWORK_GNOMES.name,
  activated: [
    {
      ref: `${CLOCKWORK_GNOMES.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
