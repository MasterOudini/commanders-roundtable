// `Certain Death` — "Destroy target creature. Its controller loses 2 life
// and you gain 2 life." Controller read BEFORE the move; indestructible
// survives and nobody pays. D202.

import { CERTAIN_DEATH } from '../../../data/fixtures/engineCards';
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
  CERTAIN_DEATH,
  'Destroy target creature. Its controller loses 2 life and you gain 2 life.',
);

export const CERTAIN_DEATH_SCRIPT: CardScript = {
  oracleId: CERTAIN_DEATH.oracleId,
  name: CERTAIN_DEATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      if (ctx.derive(target.id).keywords.has('indestructible')) return [];
      const controller = card.controller;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        },
      ];
      const them = ctx.state.players[controller];
      if (them && !them.hasLost) {
        events.push({ t: 'LifeChanged', player: controller, delta: -2, to: them.life - 2 });
      }
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 });
      }
      return events;
    },
  },
};
