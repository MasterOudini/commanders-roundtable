// `Master the Way` — "Draw a card. Master the Way deals damage to any target
// equal to the number of cards in your hand." The draw resolves FIRST, so the
// count includes the drawn card: hand length plus what the library could
// actually give (an empty library draws nothing and still loses the game
// through the one draw rule). D224.

import { MASTER_THE_WAY } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  MASTER_THE_WAY,
  'Draw a card. Master the Way deals damage to any target equal to the number of cards in your hand.',
);

export const MASTER_THE_WAY_SCRIPT: CardScript = {
  oracleId: MASTER_THE_WAY.oracleId,
  name: MASTER_THE_WAY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
        return [];
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 1)];
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const drawn = Math.min(1, library.length);
      const hand = ctx.state.zones.hand[obj.controller] ?? [];
      const amount = hand.length + drawn;
      if (amount > 0) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                target.kind === 'player'
                  ? { kind: 'player', id: target.id }
                  : { kind: 'card', id: target.id },
              amount,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        });
      }
      return events;
    },
  },
};
