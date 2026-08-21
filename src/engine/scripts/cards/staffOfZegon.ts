// `Staff of Zegon` — "{3}, {T}: Target creature gets -2/-0 until end of
// turn." D252.

import { STAFF_OF_ZEGON } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STAFF_OF_ZEGON, '{3}, {T}: Target creature gets -2/-0 until end of turn.');

export const STAFF_OF_ZEGON_SCRIPT: CardScript = {
  oracleId: STAFF_OF_ZEGON.oracleId,
  name: STAFF_OF_ZEGON.name,
  activated: [
    {
      ref: `${STAFF_OF_ZEGON.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: 0 }];
      },
    },
  ],
};
