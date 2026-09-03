// `The Underworld Cookbook` — the tap and a discarded card of my choice
// (D286) make a Food; five mana, the tap and the Book itself return a
// creature card from my graveyard to my hand.

import { THE_UNDERWORLD_COOKBOOK } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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
  THE_UNDERWORLD_COOKBOOK,
  '{T}, Discard a card: Create a Food token. (It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")\n{4}, {T}, Sacrifice this artifact: Return target creature card from your graveyard to your hand.',
);
const COOK = PRINTED.split('\n')[0] as string;
const RETURN = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}
const FOOD = tokenRef('Food|/||Artifact|');

export const THE_UNDERWORLD_COOKBOOK_SCRIPT: CardScript = {
  oracleId: THE_UNDERWORLD_COOKBOOK.oracleId,
  name: THE_UNDERWORLD_COOKBOOK.name,
  activated: [
    {
      ref: `${THE_UNDERWORLD_COOKBOOK.oracleId}#a0`,
      text: COOK,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: FOOD.oracleId,
          printingId: FOOD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
    {
      ref: `${THE_UNDERWORLD_COOKBOOK.oracleId}#a1`,
      text: RETURN,
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
