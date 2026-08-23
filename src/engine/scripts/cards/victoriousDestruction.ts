// `Victorious Destruction` — the artifact-or-land compound destroy (D207's
// Demolish shape) plus a 1-life bill on the CONTROLLER.
//
// ⚠️ The controller is read BEFORE the move: `clearBattlefieldFields` resets a
// moved card's `controller` to its OWNER (D120). That is the third outing of
// this rule in three batches (D264 Unlicensed Disintegration, D265 Vapor
// Snag). ⚠️ And the bill is paid even when the destroy misses on
// indestructible — the two sentences are independent. D266.

import { VICTORIOUS_DESTRUCTION } from '../../../data/fixtures/engineCards';
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
  VICTORIOUS_DESTRUCTION,
  'Destroy target artifact or land. Its controller loses 1 life.',
);

export const VICTORIOUS_DESTRUCTION_SCRIPT: CardScript = {
  oracleId: VICTORIOUS_DESTRUCTION.oracleId,
  name: VICTORIOUS_DESTRUCTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const controller = card.controller;

      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      const hit = ctx.state.players[controller];
      if (hit && !hit.hasLost) {
        events.push({ t: 'LifeChanged', player: controller, delta: -1, to: hit.life - 1 });
      }
      return events;
    },
  },
};
