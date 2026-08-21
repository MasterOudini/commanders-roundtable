// `Tanglebloom` — "{1}, {T}: You gain 1 life." D256.

import { TANGLEBLOOM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TANGLEBLOOM, '{1}, {T}: You gain 1 life.');

export const TANGLEBLOOM_SCRIPT: CardScript = {
  oracleId: TANGLEBLOOM.oracleId,
  name: TANGLEBLOOM.name,
  activated: [
    {
      ref: `${TANGLEBLOOM.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
