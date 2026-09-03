// `Goblin Picker` — red mana, the tap and a discarded card of my choice
// (D286) buy a card.

import { GOBLIN_PICKER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const TEXT = printed(GOBLIN_PICKER, '{R}, {T}, Discard a card: Draw a card.');

export const GOBLIN_PICKER_SCRIPT: CardScript = {
  oracleId: GOBLIN_PICKER.oracleId,
  name: GOBLIN_PICKER.name,
  activated: [
    {
      ref: `${GOBLIN_PICKER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
