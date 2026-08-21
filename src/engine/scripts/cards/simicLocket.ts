// `Simic Locket` — the Locket: hybrid-priced self-sac draw-two at #a1.
// D247.

import { SIMIC_LOCKET } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(
  SIMIC_LOCKET,
  '{T}: Add {G} or {U}.\n{G/U}{G/U}{G/U}{G/U}, {T}, Sacrifice this artifact: Draw two cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SIMIC_LOCKET_SCRIPT: CardScript = {
  oracleId: SIMIC_LOCKET.oracleId,
  name: SIMIC_LOCKET.name,
  activated: [
    {
      ref: `${SIMIC_LOCKET.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 2)];
      },
    },
  ],
};
