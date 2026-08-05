// `Boiling Rock Prison` — Land, "This land enters tapped.\n{T}: Add {B} or
// {R}.\n{4}, {T}, Sacrifice this land: Draw a card." Enters-tapped and the
// mana line are the engine's; the def owes the sacrifice-draw (Blighted
// Cataract's shape, ability index 1 after the mana line). M6.4h, D165.

import { BOILING_ROCK_PRISON } from '../../../data/fixtures/engineCards';
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
  BOILING_ROCK_PRISON,
  'This land enters tapped.\n{T}: Add {B} or {R}.\n{4}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const BOILING_ROCK_PRISON_SCRIPT: CardScript = {
  oracleId: BOILING_ROCK_PRISON.oracleId,
  name: BOILING_ROCK_PRISON.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${BOILING_ROCK_PRISON.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
