// `Ashiok's Reaper` — "Whenever an enchantment you control is put into a
// graveyard from the battlefield, draw a card." The whole card is this line.
// It LOOKS BACK (CR 603.10a): the enchantment's controller and its TYPE are
// facts about the board it left — after the move `clearBattlefieldFields` has
// reset the controller — and a wipe that takes the Reaper with it must still
// pay out. M6.4e, D162.

import { ASHIOK_S_REAPER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  ASHIOK_S_REAPER,
  'Whenever an enchantment you control is put into a graveyard from the battlefield, draw a card.',
);

export const ASHIOKS_REAPER_SCRIPT: CardScript = {
  oracleId: ASHIOK_S_REAPER.oracleId,
  name: ASHIOK_S_REAPER.name,
  triggers: [
    {
      abilityId: 'ench-dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      // The before-state (looksBack) still holds the enchantment on the
      // battlefield: controller and derived type are read there. "enchantment"
      // is asked of `derive`, never the printed line (Soul Warden's rule).
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          const card = ctx.state.cards[m.card];
          if (!card || card.controller !== mine) return false;
          return ctx.derive(m.card).typeLine.types.includes('Enchantment');
        });
      },
      label: () => "Ashiok's Reaper — draw a card",
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
