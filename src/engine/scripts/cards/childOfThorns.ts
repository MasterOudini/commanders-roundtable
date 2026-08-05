// `Child of Thorns` — "Sacrifice this creature: Target creature gets +1/+1
// until end of turn." Cabal Trainee's shape, pointed up. M6.4j, D167.

import { CHILD_OF_THORNS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CHILD_OF_THORNS, 'Sacrifice this creature: Target creature gets +1/+1 until end of turn.');

export const CHILD_OF_THORNS_SCRIPT: CardScript = {
  oracleId: CHILD_OF_THORNS.oracleId,
  name: CHILD_OF_THORNS.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${CHILD_OF_THORNS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }];
      },
    },
  ],
};
