// `Clockwork Drawbridge` — "Defender\n{2}{W}, {T}: Tap target creature."
// Benalish Trapper's shape on a defender. M6.4j, D167.

import { CLOCKWORK_DRAWBRIDGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLOCKWORK_DRAWBRIDGE, 'Defender\n{2}{W}, {T}: Tap target creature.');
const TEXT = PRINTED.split('\n')[1] as string;

export const CLOCKWORK_DRAWBRIDGE_SCRIPT: CardScript = {
  oracleId: CLOCKWORK_DRAWBRIDGE.oracleId,
  name: CLOCKWORK_DRAWBRIDGE.name,
  activated: [
    {
      // The keyword line parses as nothing; the tap is ability 0.
      ref: `${CLOCKWORK_DRAWBRIDGE.oracleId}#a0`,
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
