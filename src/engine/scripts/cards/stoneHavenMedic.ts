// `Stone Haven Medic` — the priced Soulmender: {W}, {T}: gain 1. D253.

import { STONE_HAVEN_MEDIC } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STONE_HAVEN_MEDIC, '{W}, {T}: You gain 1 life.');

export const STONE_HAVEN_MEDIC_SCRIPT: CardScript = {
  oracleId: STONE_HAVEN_MEDIC.oracleId,
  name: STONE_HAVEN_MEDIC.name,
  activated: [
    {
      ref: `${STONE_HAVEN_MEDIC.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
