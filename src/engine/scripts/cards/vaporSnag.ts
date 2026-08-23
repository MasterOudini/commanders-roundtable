// `Vapor Snag` — bounce plus a 1-life bill on the CONTROLLER.
//
// ⚠️ The controller is read BEFORE the move: `clearBattlefieldFields` resets a
// moved card's `controller` to its OWNER (D120), which is the wrong player for
// a stolen creature. D264's Unlicensed Disintegration is the same rule. D265.

import { VAPOR_SNAG } from '../../../data/fixtures/engineCards';
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
  VAPOR_SNAG,
  "Return target creature to its owner's hand. Its controller loses 1 life.",
);

export const VAPOR_SNAG_SCRIPT: CardScript = {
  oracleId: VAPOR_SNAG.oracleId,
  name: VAPOR_SNAG.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const controller = card.controller;

      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: controller },
              to: { kind: 'hand', player: card.owner },
            },
          ],
        },
      ];
      const hit = ctx.state.players[controller];
      if (hit && !hit.hasLost) {
        events.push({ t: 'LifeChanged', player: controller, delta: -1, to: hit.life - 1 });
      }
      return events;
    },
  },
};
