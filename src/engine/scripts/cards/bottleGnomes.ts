// `Bottle Gnomes` — "Sacrifice this creature: You gain 3 life." A mana-free
// self-sacrifice (Bile Urchin's cost) with an untargeted gain; no {T}, so no
// sickness gate. M6.4h, D165.

import { BOTTLE_GNOMES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BOTTLE_GNOMES, 'Sacrifice this creature: You gain 3 life.');

export const BOTTLE_GNOMES_SCRIPT: CardScript = {
  oracleId: BOTTLE_GNOMES.oracleId,
  name: BOTTLE_GNOMES.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BOTTLE_GNOMES.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 }];
      },
    },
  ],
};
