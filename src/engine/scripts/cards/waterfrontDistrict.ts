// `Waterfront District` — Land, "This land enters tapped.\n{T}: Add {U} or
// {B}.\n{2}{U}{B}, {T}, Sacrifice this land: Draw a card."
//
// ⚠️ The TWENTIETH member of a family whose first nineteen were each written
// by hand (Botanical Plaza, D165, is the base). This one is GENERATED from
// gen-dual-sac-lands.cjs — the family-table shape the M6.4 plan names, and
// the generator is kept so the twenty-first is a table row, not a file.
// The mana line COUNTS as an ability, so the draw is `#a1`. D268.

import { WATERFRONT_DISTRICT } from '../../../data/fixtures/engineCards';
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
  WATERFRONT_DISTRICT,
  'This land enters tapped.\n{T}: Add {U} or {B}.\n{2}{U}{B}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const WATERFRONT_DISTRICT_SCRIPT: CardScript = {
  oracleId: WATERFRONT_DISTRICT.oracleId,
  name: WATERFRONT_DISTRICT.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${WATERFRONT_DISTRICT.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
