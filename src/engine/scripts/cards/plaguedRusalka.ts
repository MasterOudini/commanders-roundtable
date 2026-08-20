// `Plagued Rusalka` — "{B}, Sacrifice a creature: Target creature gets
// -1/-1 until end of turn." The D168 creature chooser paying a debuff
// through the staged chain; it may pay with itself (CR 113.7a). D233.

import { PLAGUED_RUSALKA } from '../../../data/fixtures/engineCards';
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
  PLAGUED_RUSALKA,
  '{B}, Sacrifice a creature: Target creature gets -1/-1 until end of turn.',
);

export const PLAGUED_RUSALKA_SCRIPT: CardScript = {
  oracleId: PLAGUED_RUSALKA.oracleId,
  name: PLAGUED_RUSALKA.name,
  activated: [
    {
      ref: `${PLAGUED_RUSALKA.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 }];
      },
    },
  ],
};
