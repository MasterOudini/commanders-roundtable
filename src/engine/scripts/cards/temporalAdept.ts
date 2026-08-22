// `Temporal Adept` — "{U}{U}{U}, {T}: Return target permanent to its owner's
// hand." The bounce aimed at any PERMANENT (Scepter of Dominance's spec,
// D243) — a land is a legal answer, which is what makes the noun worth
// proving rather than assuming. D257.

import { TEMPORAL_ADEPT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TEMPORAL_ADEPT, "{U}{U}{U}, {T}: Return target permanent to its owner's hand.");

export const TEMPORAL_ADEPT_SCRIPT: CardScript = {
  oracleId: TEMPORAL_ADEPT.oracleId,
  name: TEMPORAL_ADEPT.name,
  activated: [
    {
      ref: `${TEMPORAL_ADEPT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
