// `Howl from Beyond` — +X/+0 on the target. D218.

import { HOWL_FROM_BEYOND } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HOWL_FROM_BEYOND, 'Target creature gets +X/+0 until end of turn.');

export const HOWL_FROM_BEYOND_SCRIPT: CardScript = {
  oracleId: HOWL_FROM_BEYOND.oracleId,
  name: HOWL_FROM_BEYOND.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: x, toughness: 0 }];
    },
  },
};
