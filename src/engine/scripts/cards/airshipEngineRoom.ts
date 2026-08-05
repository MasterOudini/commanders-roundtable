// `Airship Engine Room` — "This land enters tapped.\n{T}: Add {U} or {R}.\n
// {4}, {T}, Sacrifice this land: Draw a card." Enters-tapped is D134's
// built-in, the mana line is the engine's, and the sacrifice-self draw is the
// def's — the first LAND to pay itself away (M6.4c, D160).

import { AIRSHIP_ENGINE_ROOM } from '../../../data/fixtures/engineCards';
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
  AIRSHIP_ENGINE_ROOM,
  'This land enters tapped.\n{T}: Add {U} or {R}.\n{4}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const AIRSHIP_ENGINE_ROOM_SCRIPT: CardScript = {
  oracleId: AIRSHIP_ENGINE_ROOM.oracleId,
  name: AIRSHIP_ENGINE_ROOM.name,
  activated: [
    {
      // `#a1`: the enters-tapped line is a static, so the activated indices
      // are mana 0, this 1.
      ref: `${AIRSHIP_ENGINE_ROOM.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
