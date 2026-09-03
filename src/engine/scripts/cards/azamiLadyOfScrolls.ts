// `Azami, Lady of Scrolls` — tapping an untapped Wizard I control (the D286
// tap chooser; Azami herself qualifies) buys a card.

import { AZAMI_LADY_OF_SCROLLS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AZAMI_LADY_OF_SCROLLS, 'Tap an untapped Wizard you control: Draw a card.');

export const AZAMI_LADY_OF_SCROLLS_SCRIPT: CardScript = {
  oracleId: AZAMI_LADY_OF_SCROLLS.oracleId,
  name: AZAMI_LADY_OF_SCROLLS.name,
  activated: [
    {
      ref: `${AZAMI_LADY_OF_SCROLLS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
