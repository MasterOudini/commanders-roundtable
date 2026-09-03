// `Lawbringer` - exile on "Exile target red creature": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { LAWBRINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LAWBRINGER, "{T}, Sacrifice this creature: Exile target red creature.");
const TEXT = PRINTED;

export const LAWBRINGER_SCRIPT: CardScript = {
  oracleId: LAWBRINGER.oracleId,
  name: LAWBRINGER.name,
  activated: [
    {
      ref: `${LAWBRINGER.oracleId}#a0`,
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
