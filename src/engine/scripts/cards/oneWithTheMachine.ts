// `One with the Machine` — "Draw cards equal to the greatest mana value
// among artifacts you control." Boon of Boseiju's greatest-MV read on a
// draw. D230.

import { ONE_WITH_THE_MACHINE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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

const TEXT = printed(
  ONE_WITH_THE_MACHINE,
  'Draw cards equal to the greatest mana value among artifacts you control.',
);

export const ONE_WITH_THE_MACHINE_SCRIPT: CardScript = {
  oracleId: ONE_WITH_THE_MACHINE.oracleId,
  name: ONE_WITH_THE_MACHINE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      let greatest = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Artifact')) continue;
        const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
        if (mv > greatest) greatest = mv;
      }
      if (greatest === 0) return [];
      return [...drawEvents(ctx.state, obj.controller, greatest)];
    },
  },
};
