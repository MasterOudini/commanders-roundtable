// `Hill Giant Herdgorger` — "When this creature enters, you gain 3 life."
// Healer of the Glade's text five mana up — the same batch lands both ends
// of the curve. M6.4w, D179.

import { HILL_GIANT_HERDGORGER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HILL_GIANT_HERDGORGER, 'When this creature enters, you gain 3 life.');

export const HILL_GIANT_HERDGORGER_SCRIPT: CardScript = {
  oracleId: HILL_GIANT_HERDGORGER.oracleId,
  name: HILL_GIANT_HERDGORGER.name,
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
      label: () => 'Hill Giant Herdgorger — gain 3 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 }];
      },
    },
  ],
};
