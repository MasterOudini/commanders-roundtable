// `Spreading Rot` — "Destroy target land. Its controller loses 2 life."
// Sip of Hemlock's rider order on a land. D251.

import { SPREADING_ROT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SPREADING_ROT, 'Destroy target land. Its controller loses 2 life.');

export const SPREADING_ROT_SCRIPT: CardScript = {
  oracleId: SPREADING_ROT.oracleId,
  name: SPREADING_ROT.name,
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
