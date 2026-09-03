// `Skyshooter` — destroy on an ATTACKING creature; the combat role is the parser's and
// the validator's (D291), the keyword D289's. Generated from one table row (D292).

import { SKYSHOOTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYSHOOTER, "Reach (This creature can block creatures with flying.)\n{T}, Sacrifice this creature: Destroy target attacking or blocking creature with flying.");
const TEXT = PRINTED.split('\n')[1] as string;

export const SKYSHOOTER_SCRIPT: CardScript = {
  oracleId: SKYSHOOTER.oracleId,
  name: SKYSHOOTER.name,
  activated: [
    {
      ref: `${SKYSHOOTER.oracleId}#a0`,
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
