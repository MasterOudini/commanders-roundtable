// `Shaman of the Pack` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHAMAN_OF_THE_PACK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHAMAN_OF_THE_PACK, "When this creature enters, target opponent loses life equal to the number of Elves you control.");

const VOCAB_L0 = vocabularyEffects("Target opponent loses life equal to the number of Elves you control.", SHAMAN_OF_THE_PACK.name);
const VOCAB_T_L0 = vocabularyTargets("Target opponent loses life equal to the number of Elves you control.");

export const SHAMAN_OF_THE_PACK_SCRIPT: CardScript = {
  oracleId: SHAMAN_OF_THE_PACK.oracleId,
  name: SHAMAN_OF_THE_PACK.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Shaman of the Pack - Target opponent loses life equal to the number of Elves you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
