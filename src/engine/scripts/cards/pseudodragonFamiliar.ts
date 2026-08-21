// `Pseudodragon Familiar` — "{2}{U}: Target creature gains flying until
// end of turn." Pixie Queen's grant without the tap; the Flying line is
// the engine's. D235.

import { PSEUDODRAGON_FAMILIAR } from '../../../data/fixtures/engineCards';
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
  PSEUDODRAGON_FAMILIAR,
  'Flying\n{2}{U}: Target creature gains flying until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const PSEUDODRAGON_FAMILIAR_SCRIPT: CardScript = {
  oracleId: PSEUDODRAGON_FAMILIAR.oracleId,
  name: PSEUDODRAGON_FAMILIAR.name,
  activated: [
    {
      ref: `${PSEUDODRAGON_FAMILIAR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['flying'] },
        ];
      },
    },
  ],
};
