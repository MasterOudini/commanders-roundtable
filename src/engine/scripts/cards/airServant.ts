// `Air Servant` — Flying is the engine's; the ability taps a flyer. The
// flying restriction is the parser's and the validator's (D289).

import { AIR_SERVANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AIR_SERVANT, 'Flying\n{2}{U}: Tap target creature with flying.');
const TEXT = PRINTED.split('\n')[1] as string;

export const AIR_SERVANT_SCRIPT: CardScript = {
  oracleId: AIR_SERVANT.oracleId,
  name: AIR_SERVANT.name,
  activated: [
    {
      ref: `${AIR_SERVANT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
