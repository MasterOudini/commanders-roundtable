// `Skybridge Towers` — the three-line self-sac draw land: tapped built-in,
// mana at a0, "{2}{W}{U}, {T}, Sacrifice this land: Draw a card." at #a1
// (TEXT = split[2]). Foggy Bottom Swamp's shape in Azorius. D248.

import { SKYBRIDGE_TOWERS } from '../../../data/fixtures/engineCards';
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
  SKYBRIDGE_TOWERS,
  'This land enters tapped.\n{T}: Add {W} or {U}.\n{2}{W}{U}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const SKYBRIDGE_TOWERS_SCRIPT: CardScript = {
  oracleId: SKYBRIDGE_TOWERS.oracleId,
  name: SKYBRIDGE_TOWERS.name,
  activated: [
    {
      ref: `${SKYBRIDGE_TOWERS.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
