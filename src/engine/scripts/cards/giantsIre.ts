// `Giant's Ire` — "Giant's Ire deals 4 damage to target player or
// planeswalker. If you control a Giant, draw a card." The board query is
// DERIVED subtypes. D215.

import { GIANT_S_IRE } from '../../../data/fixtures/engineCards';
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
  GIANT_S_IRE,
  "Giant's Ire deals 4 damage to target player or planeswalker. If you control a Giant, draw a card.",
);

export const GIANTS_IRE_SCRIPT: CardScript = {
  oracleId: GIANT_S_IRE.oracleId,
  name: GIANT_S_IRE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
        return [];
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                target.kind === 'player'
                  ? { kind: 'player', id: target.id }
                  : { kind: 'card', id: target.id },
              amount: 4,
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
      let giant = false;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Giant')) {
          giant = true;
          break;
        }
      }
      if (giant) events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
