// `Seal of Doom` - destroy on "Destroy target nonblack creature. It can't be regenerated": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { SEAL_OF_DOOM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEAL_OF_DOOM, "Sacrifice this enchantment: Destroy target nonblack creature. It can't be regenerated.");
const TEXT = PRINTED;

export const SEAL_OF_DOOM_SCRIPT: CardScript = {
  oracleId: SEAL_OF_DOOM.oracleId,
  name: SEAL_OF_DOOM.name,
  activated: [
    {
      ref: `${SEAL_OF_DOOM.oracleId}#a0`,
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
