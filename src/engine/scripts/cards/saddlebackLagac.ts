// `Saddleback Lagac` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SADDLEBACK_LAGAC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SADDLEBACK_LAGAC, "When this creature enters, support 2. (Put a +1/+1 counter on each of up to two other target creatures.)");

const VOCAB_L0 = vocabularyEffects("Support 2.", SADDLEBACK_LAGAC.name);
const VOCAB_T_L0 = vocabularyTargets("Support 2.");

export const SADDLEBACK_LAGAC_SCRIPT: CardScript = {
  oracleId: SADDLEBACK_LAGAC.oracleId,
  name: SADDLEBACK_LAGAC.name,
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
      label: () => "Saddleback Lagac - Support 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
