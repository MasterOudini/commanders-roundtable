// `Temple Acolyte` — the plain ETB gain at three. D257.

import { TEMPLE_ACOLYTE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TEMPLE_ACOLYTE, "When this creature enters, you gain 3 life.");

export const TEMPLE_ACOLYTE_SCRIPT: CardScript = {
  oracleId: TEMPLE_ACOLYTE.oracleId,
  name: TEMPLE_ACOLYTE.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Temple Acolyte — you gain 3 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [
          { t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 },
        ];
      },
    },
  ],
};
