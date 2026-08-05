// `Abzan Banner` — "{T}: Add {W}, {B}, or {G}.\n{W}{B}{G}, {T}, Sacrifice this
// artifact: Draw a card." Hedron Archive's shape: the mana line is the
// engine's, the sacrifice-self draw is the def's. M6.4c, D160.

import { ABZAN_BANNER } from '../../../data/fixtures/engineCards';
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
  ABZAN_BANNER,
  '{T}: Add {W}, {B}, or {G}.\n{W}{B}{G}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const ABZAN_BANNER_SCRIPT: CardScript = {
  oracleId: ABZAN_BANNER.oracleId,
  name: ABZAN_BANNER.name,
  activated: [
    {
      ref: `${ABZAN_BANNER.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
