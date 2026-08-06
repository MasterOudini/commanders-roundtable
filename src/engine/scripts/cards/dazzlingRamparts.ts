// `Dazzling Ramparts` — "Defender\n{1}{W}, {T}: Tap target creature."
// Benalish Trapper's tap on a Wall. M6.4m, D170.

import { DAZZLING_RAMPARTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAZZLING_RAMPARTS, 'Defender\n{1}{W}, {T}: Tap target creature.');
const TEXT = PRINTED.split('\n')[1] as string;

export const DAZZLING_RAMPARTS_SCRIPT: CardScript = {
  oracleId: DAZZLING_RAMPARTS.oracleId,
  name: DAZZLING_RAMPARTS.name,
  activated: [
    {
      ref: `${DAZZLING_RAMPARTS.oracleId}#a0`,
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
