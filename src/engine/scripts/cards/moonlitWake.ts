// `Moonlit Wake` — "Whenever a creature dies, you gain 1 life." ANY
// creature, any controller — Field of Souls minus every filter but the
// derived type, looking back at the board it died on. D226.

import { MOONLIT_WAKE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MOONLIT_WAKE, 'Whenever a creature dies, you gain 1 life.');

export const MOONLIT_WAKE_SCRIPT: CardScript = {
  oracleId: MOONLIT_WAKE.oracleId,
  name: MOONLIT_WAKE.name,
  triggers: [
    {
      abilityId: 'any-dies-gain',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.from.kind === 'battlefield' &&
            m.to.kind === 'graveyard' &&
            ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => 'Moonlit Wake — gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
