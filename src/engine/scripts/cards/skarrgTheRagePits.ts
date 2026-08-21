// `Skarrg, the Rage Pits` — "{R}{G}, {T}: Target creature gets +1/+1 and
// gains trample until end of turn." The activated grant land at #a1 behind
// the mana line: the trample rides D194's carrier and ends at cleanup. D248.

import { SKARRG_THE_RAGE_PITS } from '../../../data/fixtures/engineCards';
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
  SKARRG_THE_RAGE_PITS,
  '{T}: Add {C}.\n{R}{G}, {T}: Target creature gets +1/+1 and gains trample until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SKARRG_THE_RAGE_PITS_SCRIPT: CardScript = {
  oracleId: SKARRG_THE_RAGE_PITS.oracleId,
  name: SKARRG_THE_RAGE_PITS.name,
  activated: [
    {
      ref: `${SKARRG_THE_RAGE_PITS.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 1,
            toughness: 1,
            keywords: ['trample'],
          },
        ];
      },
    },
  ],
};
