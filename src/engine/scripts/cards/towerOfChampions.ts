// `Tower of Champions` — the {8}, {T} cycle's pump. Same cost as its three
// siblings, a different payload; see `towerOfCalamities.ts` for why the four
// are hand-written rather than generated. D261.

import { TOWER_OF_CHAMPIONS } from '../../../data/fixtures/engineCards';
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
  TOWER_OF_CHAMPIONS,
  '{8}, {T}: Target creature gets +6/+6 until end of turn.',
);

export const TOWER_OF_CHAMPIONS_SCRIPT: CardScript = {
  oracleId: TOWER_OF_CHAMPIONS.oracleId,
  name: TOWER_OF_CHAMPIONS.name,
  activated: [
    {
      ref: `${TOWER_OF_CHAMPIONS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 6, toughness: 6 }];
      },
    },
  ],
};
