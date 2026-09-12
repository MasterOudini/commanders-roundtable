// `Rescue Leopard` - a becomesTapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RESCUE_LEOPARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RESCUE_LEOPARD, "Whenever this creature becomes tapped, you may discard a card. If you do, draw a card.");

const VOCAB_L0 = vocabularyEffects("You may discard a card. If you do, draw a card.", RESCUE_LEOPARD.name);
const VOCAB_T_L0 = vocabularyTargets("You may discard a card. If you do, draw a card.");

export const RESCUE_LEOPARD_SCRIPT: CardScript = {
  oracleId: RESCUE_LEOPARD.oracleId,
  name: RESCUE_LEOPARD.name,
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: PRINTED,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Rescue Leopard - You may discard a card. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
