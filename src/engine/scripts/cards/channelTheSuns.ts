// `Channel the Suns` — "Add {W}{U}{B}{R}{G}." One of each. D203.

import { CHANNEL_THE_SUNS } from '../../../data/fixtures/engineCards';
import { EMPTY_POOL } from '../../types/mana';
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

const TEXT = printed(CHANNEL_THE_SUNS, 'Add {W}{U}{B}{R}{G}.');

export const CHANNEL_THE_SUNS_SCRIPT: CardScript = {
  oracleId: CHANNEL_THE_SUNS.oracleId,
  name: CHANNEL_THE_SUNS.name,
  spell: {
    text: TEXT,
    resolve: (_ctx, self, obj): readonly EventBody[] => [
      {
        t: 'ManaAdded',
        player: obj.controller,
        mana: { ...EMPTY_POOL, W: 1, U: 1, B: 1, R: 1, G: 1 },
        source: self,
      },
    ],
  },
};
