// `Ravenous Baloth` — "Sacrifice a Beast: You gain 4 life." The no-mana
// subtype chooser; the Baloth is a Beast and may pay with itself
// (CR 113.7a). D237.

import { RAVENOUS_BALOTH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RAVENOUS_BALOTH, 'Sacrifice a Beast: You gain 4 life.');

export const RAVENOUS_BALOTH_SCRIPT: CardScript = {
  oracleId: RAVENOUS_BALOTH.oracleId,
  name: RAVENOUS_BALOTH.name,
  activated: [
    {
      ref: `${RAVENOUS_BALOTH.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: player.life + 4 }];
      },
    },
  ],
};
