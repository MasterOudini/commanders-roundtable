// `Swallowing Plague` — X damage to a creature, X life back. D255.

import { SWALLOWING_PLAGUE } from '../../../data/fixtures/engineCards';
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
  SWALLOWING_PLAGUE,
  'Swallowing Plague deals X damage to target creature and you gain X life.',
);

export const SWALLOWING_PLAGUE_SCRIPT: CardScript = {
  oracleId: SWALLOWING_PLAGUE.oracleId,
  name: SWALLOWING_PLAGUE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: x,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
      const player = ctx.state.players[obj.controller];
      if (player && !player.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: x, to: player.life + x });
      }
      return events;
    },
  },
};
