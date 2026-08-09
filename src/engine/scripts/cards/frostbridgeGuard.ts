// `Frostbridge Guard` — "{2}{W}, {T}: Tap target creature." Elite
// Arrester's tap in white. M6.4s, D175.

import { FROSTBRIDGE_GUARD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FROSTBRIDGE_GUARD, '{2}{W}, {T}: Tap target creature.');

export const FROSTBRIDGE_GUARD_SCRIPT: CardScript = {
  oracleId: FROSTBRIDGE_GUARD.oracleId,
  name: FROSTBRIDGE_GUARD.name,
  activated: [
    {
      ref: `${FROSTBRIDGE_GUARD.oracleId}#a0`,
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
