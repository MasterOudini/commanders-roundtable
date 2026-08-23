// `Vial of Poison` — the self-sacrifice DEATHTOUCH grant on D194's carrier.
// Deathtouch is in the closed GRANTABLE map, so this is a Tier-2 grant that
// the combat rules read for free. D266.

import { VIAL_OF_POISON } from '../../../data/fixtures/engineCards';
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
  VIAL_OF_POISON,
  '{1}, Sacrifice this artifact: Target creature gains deathtouch until end of turn. (Any amount of damage it deals to a creature is enough to destroy it.)',
);

export const VIAL_OF_POISON_SCRIPT: CardScript = {
  oracleId: VIAL_OF_POISON.oracleId,
  name: VIAL_OF_POISON.name,
  activated: [
    {
      ref: `${VIAL_OF_POISON.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 0,
            toughness: 0,
            keywords: ['deathtouch'],
          },
        ];
      },
    },
  ],
};
