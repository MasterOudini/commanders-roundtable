// `Priest of Ancient Lore` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PRIEST_OF_ANCIENT_LORE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PRIEST_OF_ANCIENT_LORE, "When this creature enters, you gain 1 life and draw a card.");

const VOCAB_L0 = vocabularyEffects("You gain 1 life and draw a card.", PRIEST_OF_ANCIENT_LORE.name);
const VOCAB_T_L0 = vocabularyTargets("You gain 1 life and draw a card.");

export const PRIEST_OF_ANCIENT_LORE_SCRIPT: CardScript = {
  oracleId: PRIEST_OF_ANCIENT_LORE.oracleId,
  name: PRIEST_OF_ANCIENT_LORE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Priest of Ancient Lore - You gain 1 life and draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
