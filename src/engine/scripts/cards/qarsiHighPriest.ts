// `Qarsi High Priest` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QARSI_HIGH_PRIEST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QARSI_HIGH_PRIEST, "{1}{B}, {T}, Sacrifice another creature: Manifest the top card of your library. (Put that card onto the battlefield face down as a 2/2 creature. Turn it face up any time for its mana cost if it's a creature card.)");

const VOCAB_A0 = vocabularyEffects("Manifest the top card of your library.", QARSI_HIGH_PRIEST.name);
const VOCAB_T_A0 = vocabularyTargets("Manifest the top card of your library.");

export const QARSI_HIGH_PRIEST_SCRIPT: CardScript = {
  oracleId: QARSI_HIGH_PRIEST.oracleId,
  name: QARSI_HIGH_PRIEST.name,
  activated: [
    {
      ref: `${QARSI_HIGH_PRIEST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
