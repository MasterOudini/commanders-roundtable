// `Notorious Assassin` - destroy on "Destroy target nonblack creature. It can't be regenerated": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { NOTORIOUS_ASSASSIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NOTORIOUS_ASSASSIN, "{2}{B}, {T}, Discard a card: Destroy target nonblack creature. It can't be regenerated.");
const TEXT = PRINTED;

export const NOTORIOUS_ASSASSIN_SCRIPT: CardScript = {
  oracleId: NOTORIOUS_ASSASSIN.oracleId,
  name: NOTORIOUS_ASSASSIN.name,
  activated: [
    {
      ref: `${NOTORIOUS_ASSASSIN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b - an indestructible permanent is not destroyed.
        if (ctx.derive(target.id).keywords.has('indestructible')) return [];
        return [
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
      },
    },
  ],
};
