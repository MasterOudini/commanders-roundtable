// `Pharika's Cure` — "Pharika's Cure deals 2 damage to target creature and
// you gain 2 life." Last Kiss's shape under its own name. D232.

import { PHARIKA_S_CURE } from '../../../data/fixtures/engineCards';
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
  PHARIKA_S_CURE,
  "Pharika's Cure deals 2 damage to target creature and you gain 2 life.",
);

export const PHARIKAS_CURE_SCRIPT: CardScript = {
  oracleId: PHARIKA_S_CURE.oracleId,
  name: PHARIKA_S_CURE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const player = ctx.state.players[obj.controller];
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: 2,
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
      if (player && !player.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 });
      }
      return events;
    },
  },
};
