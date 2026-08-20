// `Essence Extraction` — "Essence Extraction deals 3 damage to target
// creature and you gain 3 life." Douse in Gloom at three. D211.

import { ESSENCE_EXTRACTION } from '../../../data/fixtures/engineCards';
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
  ESSENCE_EXTRACTION,
  'Essence Extraction deals 3 damage to target creature and you gain 3 life.',
);

export const ESSENCE_EXTRACTION_SCRIPT: CardScript = {
  oracleId: ESSENCE_EXTRACTION.oracleId,
  name: ESSENCE_EXTRACTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const me = ctx.state.players[obj.controller];
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: 3,
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
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 });
      }
      return events;
    },
  },
};
