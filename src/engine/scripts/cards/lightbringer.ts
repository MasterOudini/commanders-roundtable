// `Lightbringer` - exile on "Exile target black creature": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { LIGHTBRINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIGHTBRINGER, "{T}, Sacrifice this creature: Exile target black creature.");
const TEXT = PRINTED;

export const LIGHTBRINGER_SCRIPT: CardScript = {
  oracleId: LIGHTBRINGER.oracleId,
  name: LIGHTBRINGER.name,
  activated: [
    {
      ref: `${LIGHTBRINGER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'exile', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
};
