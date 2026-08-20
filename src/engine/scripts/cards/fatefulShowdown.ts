// `Fateful Showdown` — "Fateful Showdown deals damage to any target equal
// to the number of cards in your hand. Discard all the cards in your
// hand, then draw that many cards." ONE count serves all three clauses:
// the hand size at resolution (the spell itself is on the stack). D212.

import { FATEFUL_SHOWDOWN } from '../../../data/fixtures/engineCards';
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
  FATEFUL_SHOWDOWN,
  'Fateful Showdown deals damage to any target equal to the number of cards in your hand. Discard all the cards in your hand, then draw that many cards.',
);

export const FATEFUL_SHOWDOWN_SCRIPT: CardScript = {
  oracleId: FATEFUL_SHOWDOWN.oracleId,
  name: FATEFUL_SHOWDOWN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const hand = ctx.state.zones.hand[obj.controller] ?? [];
      const n = hand.length;
      const events: EventBody[] = [];
      const target = obj.targets[0];
      const targetOk =
        target &&
        target.kind !== 'stack' &&
        (target.kind === 'player' ||
          ctx.state.cards[target.id]?.zone.kind === 'battlefield');
      if (n > 0 && targetOk) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                target.kind === 'player'
                  ? { kind: 'player', id: target.id }
                  : { kind: 'card', id: target.id },
              amount: n,
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
      if (n > 0) {
        events.push({
          t: 'CardsMoved',
          moves: hand.map((id) => ({
            card: id,
            from: { kind: 'hand' as const, player: obj.controller },
            to: { kind: 'graveyard' as const, player: ctx.state.cards[id]?.owner ?? obj.controller },
          })),
        });
        events.push(...drawEvents(ctx.state, obj.controller, n));
      }
      return events;
    },
  },
};
