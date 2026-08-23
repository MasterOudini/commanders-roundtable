// `Tuknir Deathlock` — flying plus the {R}{G}, {T} pump. The keyword line
// never counts, so the def's text is `split[1]`. One of TWO legendaries this
// batch lands (with Tura Kennerud), taking the executable pool 79 -> 81. D262.

import { TUKNIR_DEATHLOCK } from '../../../data/fixtures/engineCards';
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
  TUKNIR_DEATHLOCK,
  'Flying\n{R}{G}, {T}: Target creature gets +2/+2 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TUKNIR_DEATHLOCK_SCRIPT: CardScript = {
  oracleId: TUKNIR_DEATHLOCK.oracleId,
  name: TUKNIR_DEATHLOCK.name,
  activated: [
    {
      // The keyword line is not an ability, so the pump is #a0.
      ref: `${TUKNIR_DEATHLOCK.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 }];
      },
    },
  ],
};
