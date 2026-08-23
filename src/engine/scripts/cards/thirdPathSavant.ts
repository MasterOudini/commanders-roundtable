// `Third Path Savant` — the repeatable no-tap draw-two at {7} (Azure Mage's
// shape, D163, one card wider and six mana dearer). No tap in the cost, so
// it is limited only by mana. D259.

import { THIRD_PATH_SAVANT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(THIRD_PATH_SAVANT, '{7}: Draw two cards.');

export const THIRD_PATH_SAVANT_SCRIPT: CardScript = {
  oracleId: THIRD_PATH_SAVANT.oracleId,
  name: THIRD_PATH_SAVANT.name,
  activated: [
    {
      ref: `${THIRD_PATH_SAVANT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
