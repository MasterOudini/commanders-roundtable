// `Kessig Malcontents` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KESSIG_MALCONTENTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KESSIG_MALCONTENTS, "When this creature enters, it deals damage to target player or planeswalker equal to the number of Humans you control.");

const VOCAB_L0 = vocabularyEffects("~ deals damage to target player or planeswalker equal to the number of Humans you control.", KESSIG_MALCONTENTS.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals damage to target player or planeswalker equal to the number of Humans you control.");

export const KESSIG_MALCONTENTS_SCRIPT: CardScript = {
  oracleId: KESSIG_MALCONTENTS.oracleId,
  name: KESSIG_MALCONTENTS.name,
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
      label: () => "Kessig Malcontents - ~ deals damage to target player or planeswalker equal to the number of Humans you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
