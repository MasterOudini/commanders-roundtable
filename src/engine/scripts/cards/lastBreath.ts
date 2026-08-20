// `Last Breath` — exile the small creature; its controller banks 4
// either way the exile goes (the rider is unconditional). D222.

import { LAST_BREATH } from '../../../data/fixtures/engineCards';
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
  LAST_BREATH,
  'Exile target creature with power 2 or less. Its controller gains 4 life.',
);

export const LAST_BREATH_SCRIPT: CardScript = {
  oracleId: LAST_BREATH.oracleId,
  name: LAST_BREATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: controller },
              to: { kind: 'exile', player: card.owner },
            },
          ],
        },
      ];
      const p = ctx.state.players[controller];
      if (p && !p.hasLost) {
        events.push({ t: 'LifeChanged', player: controller, delta: 4, to: p.life + 4 });
      }
      return events;
    },
  },
};
