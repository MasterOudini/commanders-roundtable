// `Elvish Herder` — "{G}: Target creature gains trample until end of
// turn." Advance Scout's grant with the trample rider. D210.

import { ELVISH_HERDER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ELVISH_HERDER, '{G}: Target creature gains trample until end of turn.');

export const ELVISH_HERDER_SCRIPT: CardScript = {
  oracleId: ELVISH_HERDER.oracleId,
  name: ELVISH_HERDER.name,
  activated: [
    {
      ref: `${ELVISH_HERDER.oracleId}#a0`,
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
            keywords: ['trample'],
          },
        ];
      },
    },
  ],
};
