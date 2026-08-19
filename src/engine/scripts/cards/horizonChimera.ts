// `Horizon Chimera` — "Flash\nFlying, trample\nWhenever you draw a card, you
// gain 1 life." The COMPOSITION proof of two seams landing together: the
// trigger watches `DrewCards` (D189 — a real draw, never an Impulse-take or
// an opening hand) and fans out PER DRAWN CARD (D190 — "a card" is per-item
// wording, so a draw-two pays TWO, one firing per card, where the plain bus
// would have paid one). D179 named this exact card when it named the class.

import { HORIZON_CHIMERA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  HORIZON_CHIMERA,
  'Flash\nFlying, trample\nWhenever you draw a card, you gain 1 life.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const HORIZON_CHIMERA_SCRIPT: CardScript = {
  oracleId: HORIZON_CHIMERA.oracleId,
  name: HORIZON_CHIMERA.name,
  triggers: [
    {
      abilityId: 'draw',
      text: TEXT,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      // One firing PER CARD DRAWN — the item is the drawn card, though this
      // resolve needs only the multiplicity.
      perItem: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.cards : []),
      label: () => 'Horizon Chimera — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
