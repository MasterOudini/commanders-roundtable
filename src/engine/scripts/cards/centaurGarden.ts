// `Centaur Garden` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CENTAUR_GARDEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CENTAUR_GARDEN, "{T}: Add {G}. This land deals 1 damage to you.\nThreshold — {G}, {T}, Sacrifice this land: Target creature gets +3/+3 until end of turn. Activate only if there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

export const CENTAUR_GARDEN_SCRIPT: CardScript = {
  oracleId: CENTAUR_GARDEN.oracleId,
  name: CENTAUR_GARDEN.name,
  activated: [
    {
      ref: `${CENTAUR_GARDEN.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 3, toughness: 3 }];
      },
    },
  ],
};
