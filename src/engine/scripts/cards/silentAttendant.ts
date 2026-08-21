// `Silent Attendant` — "{T}: You gain 1 life." The tap-gain. D247.

import { SILENT_ATTENDANT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SILENT_ATTENDANT, '{T}: You gain 1 life.');

export const SILENT_ATTENDANT_SCRIPT: CardScript = {
  oracleId: SILENT_ATTENDANT.oracleId,
  name: SILENT_ATTENDANT.name,
  activated: [
    {
      ref: `${SILENT_ATTENDANT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
