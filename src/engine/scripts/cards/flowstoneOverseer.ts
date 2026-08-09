// `Flowstone Overseer` — "{R}{R}: Target creature gets +1/-1 until end of
// turn." The mixed-sign pump — the minus half can kill through the SBA,
// which is what the card is for. M6.4s, D175.

import { FLOWSTONE_OVERSEER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FLOWSTONE_OVERSEER, '{R}{R}: Target creature gets +1/-1 until end of turn.');

export const FLOWSTONE_OVERSEER_SCRIPT: CardScript = {
  oracleId: FLOWSTONE_OVERSEER.oracleId,
  name: FLOWSTONE_OVERSEER.name,
  activated: [
    {
      ref: `${FLOWSTONE_OVERSEER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: -1 }];
      },
    },
  ],
};
