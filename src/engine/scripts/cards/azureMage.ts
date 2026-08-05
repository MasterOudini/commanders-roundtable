// `Azure Mage` — "{3}{U}: Draw a card." The whole card is one repeatable
// ActivatedDef: no {T} in the cost, so it can go twice in a turn with the
// mana (Ant Queen's precedent), and no summoning sickness applies. M6.4f,
// D163.

import { AZURE_MAGE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AZURE_MAGE, '{3}{U}: Draw a card.');

export const AZURE_MAGE_SCRIPT: CardScript = {
  oracleId: AZURE_MAGE.oracleId,
  name: AZURE_MAGE.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${AZURE_MAGE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
