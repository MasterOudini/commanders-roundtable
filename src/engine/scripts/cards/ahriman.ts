// `Ahriman` — "Flying, deathtouch\n{3}, Sacrifice another creature or
// artifact: Draw a card." The keyword line is the engine's (Tier 2); the def
// owes the draw. The cost is the chooser's OR-predicate with the "another"
// exclusion (D168): a creature OR an artifact pays, Ahriman itself never can —
// `sacrificeCandidatesFor` drops the source before the predicates are asked.
// M6.4k, D168.

import { AHRIMAN } from '../../../data/fixtures/engineCards';
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
  AHRIMAN,
  'Flying, deathtouch\n{3}, Sacrifice another creature or artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const AHRIMAN_SCRIPT: CardScript = {
  oracleId: AHRIMAN.oracleId,
  name: AHRIMAN.name,
  activated: [
    {
      // The keyword line has no colon, so the sacrifice line parses as
      // ability 0 — pinned by the test's parse assertion.
      ref: `${AHRIMAN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
