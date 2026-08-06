// `Devotee of Strength` — "{4}{G}: Target creature gets +2/+2 until end of
// turn." A mana-only activated pump through the layer-7c modifier — cleanup
// undoes it, no chooser involved. M6.4o, D171.

import { DEVOTEE_OF_STRENGTH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DEVOTEE_OF_STRENGTH, '{4}{G}: Target creature gets +2/+2 until end of turn.');

export const DEVOTEE_OF_STRENGTH_SCRIPT: CardScript = {
  oracleId: DEVOTEE_OF_STRENGTH.oracleId,
  name: DEVOTEE_OF_STRENGTH.name,
  activated: [
    {
      ref: `${DEVOTEE_OF_STRENGTH.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 }];
      },
    },
  ],
};
