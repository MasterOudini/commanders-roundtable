// `Sip of Hemlock` — "Destroy target creature. Its controller loses 2 life."
// Melt Terrain's rider order on a creature: the controller is read BEFORE the
// move, and the loss is its own sentence, so an indestructible creature still
// costs its controller the 2. D248.

import { SIP_OF_HEMLOCK } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SIP_OF_HEMLOCK, 'Destroy target creature. Its controller loses 2 life.');

export const SIP_OF_HEMLOCK_SCRIPT: CardScript = {
  oracleId: SIP_OF_HEMLOCK.oracleId,
  name: SIP_OF_HEMLOCK.name,
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
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      const player = ctx.state.players[controller];
      if (player && !player.hasLost) {
        events.push({ t: 'LifeChanged', player: controller, delta: -2, to: player.life - 2 });
      }
      return events;
    },
  },
};
