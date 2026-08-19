// `Advance Scout` — "{W}: Target creature gains first strike until end of
// turn." The first ACTIVATED consumer of D194's keyword rider: the def
// emits the same PtModifiedUntilEndOfTurn a pump spell emits, +0/+0 with
// the keyword, ending at the same cleanup. D196.

import { ADVANCE_SCOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  ADVANCE_SCOUT,
  'First strike\n{W}: Target creature gains first strike until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const ADVANCE_SCOUT_SCRIPT: CardScript = {
  oracleId: ADVANCE_SCOUT.oracleId,
  name: ADVANCE_SCOUT.name,
  activated: [
    {
      ref: `${ADVANCE_SCOUT.oracleId}#a0`,
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
            keywords: ['firstStrike'],
          },
        ];
      },
    },
  ],
};
