// `An-Havva Inn` — "You gain X plus 1 life, where X is the number of green
// creatures on the battlefield." Derived colors AND types, any controller
// (the card says so). D197.

import { AN_HAVVA_INN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  AN_HAVVA_INN,
  'You gain X plus 1 life, where X is the number of green creatures on the battlefield.',
);

export const AN_HAVVA_INN_SCRIPT: CardScript = {
  oracleId: AN_HAVVA_INN.oracleId,
  name: AN_HAVVA_INN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      let green = 0;
      for (const id of ctx.state.zones.battlefield) {
        const d = ctx.derive(id);
        if (d.typeLine.types.includes('Creature') && d.colors.includes('G')) green++;
      }
      const gain = green + 1;
      return [{ t: 'LifeChanged', player: obj.controller, delta: gain, to: player.life + gain }];
    },
  },
};
