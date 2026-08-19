// `Memorial to Folly` — Land, "This land enters tapped.\n{T}: Add
// {B}.\n{2}{B}, {T}, Sacrifice this land: Return target creature card from
// your graveyard to your hand." Malevolent Awakening's targeted graveyard
// return (D138's aim) paid with the land itself. M6.4ad, D186.

import { MEMORIAL_TO_FOLLY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  MEMORIAL_TO_FOLLY,
  'This land enters tapped.\n{T}: Add {B}.\n{2}{B}, {T}, Sacrifice this land: Return target creature card from your graveyard to your hand.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const MEMORIAL_TO_FOLLY_SCRIPT: CardScript = {
  oracleId: MEMORIAL_TO_FOLLY.oracleId,
  name: MEMORIAL_TO_FOLLY.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the return as ability 1.
      ref: `${MEMORIAL_TO_FOLLY.oracleId}#a1`,
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
