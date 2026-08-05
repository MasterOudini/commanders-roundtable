// `Adun Oakenshield` — "{B}{R}{G}, {T}: Return target creature card from your
// graveyard to your hand." The first ACTIVATED graveyard return (M6.4c, D160):
// the target spec carries D138's zone + card-type restrictions, and the move
// goes to the card's OWNER's hand.

import { ADUN_OAKENSHIELD } from '../../../data/fixtures/engineCards';
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
  ADUN_OAKENSHIELD,
  '{B}{R}{G}, {T}: Return target creature card from your graveyard to your hand.',
);

export const ADUN_OAKENSHIELD_SCRIPT: CardScript = {
  oracleId: ADUN_OAKENSHIELD.oracleId,
  name: ADUN_OAKENSHIELD.name,
  activated: [
    {
      ref: `${ADUN_OAKENSHIELD.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'graveyard', player: card.owner },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
