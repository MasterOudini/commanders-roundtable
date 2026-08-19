// `Memorial to War` — Land, "This land enters tapped.\n{T}: Add
// {R}.\n{4}{R}, {T}, Sacrifice this land: Destroy target land." The targeted
// destroy behind a land's mana line — and the indestructible check matters
// here, because Darksteel Citadel IS a land. M6.4ad, D186.

import { MEMORIAL_TO_WAR } from '../../../data/fixtures/engineCards';
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
  MEMORIAL_TO_WAR,
  'This land enters tapped.\n{T}: Add {R}.\n{4}{R}, {T}, Sacrifice this land: Destroy target land.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const MEMORIAL_TO_WAR_SCRIPT: CardScript = {
  oracleId: MEMORIAL_TO_WAR.oracleId,
  name: MEMORIAL_TO_WAR.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the destroy as ability 1.
      ref: `${MEMORIAL_TO_WAR.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
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
