// `Gutless Ghoul` — "{1}, Sacrifice a creature: You gain 2 life." The D168
// creature chooser (it may pay with itself, CR 113.7a) buying life. M6.4v,
// D178.

import { GUTLESS_GHOUL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GUTLESS_GHOUL, '{1}, Sacrifice a creature: You gain 2 life.');

export const GUTLESS_GHOUL_SCRIPT: CardScript = {
  oracleId: GUTLESS_GHOUL.oracleId,
  name: GUTLESS_GHOUL.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GUTLESS_GHOUL.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
