// `Overgrown Estate` — "Sacrifice a land: You gain 3 life." The no-mana
// land chooser (Aura Fracture's shape) paying a gain. D231.

import { OVERGROWN_ESTATE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(OVERGROWN_ESTATE, 'Sacrifice a land: You gain 3 life.');

export const OVERGROWN_ESTATE_SCRIPT: CardScript = {
  oracleId: OVERGROWN_ESTATE.oracleId,
  name: OVERGROWN_ESTATE.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${OVERGROWN_ESTATE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 }];
      },
    },
  ],
};
