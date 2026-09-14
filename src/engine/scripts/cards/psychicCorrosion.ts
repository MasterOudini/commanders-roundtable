// `Psychic Corrosion` - a drawsCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PSYCHIC_CORROSION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PSYCHIC_CORROSION, "Whenever you draw a card, each opponent mills two cards.");

const VOCAB_L0 = vocabularyEffects("Each opponent mills two cards.", PSYCHIC_CORROSION.name);
const VOCAB_T_L0 = vocabularyTargets("Each opponent mills two cards.");

export const PSYCHIC_CORROSION_SCRIPT: CardScript = {
  oracleId: PSYCHIC_CORROSION.oracleId,
  name: PSYCHIC_CORROSION.name,
  triggers: [
    {
      abilityId: 'drawsCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      label: () => "Psychic Corrosion - Each opponent mills two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
