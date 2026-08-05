// `Hedron Archive` — `{4}` Artifact, "{T}: Add {C}{C}.\n{2}, {T}, Sacrifice
// this artifact: Draw two cards." — the first SELF-SACRIFICE cost (M6.4b,
// D159). The sacrifice is charged at ACTIVATION by `finishAbility`, so this
// def's `resolve` runs with its source already in the graveyard — which is why
// it reads `obj.controller` and nothing about `self`'s position.
//
// ⚠️ The cost is chargeable ONLY because this def exists: `legal.ts` and
// `handlers.ts` refuse a self-sacrifice for any ability the registry will not
// run — eating a permanent for nothing is not D122's disclosed status quo.

import { HEDRON_ARCHIVE } from '../../../data/fixtures/engineCards';
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
  HEDRON_ARCHIVE,
  '{T}: Add {C}{C}.\n{2}, {T}, Sacrifice this artifact: Draw two cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const HEDRON_ARCHIVE_SCRIPT: CardScript = {
  oracleId: HEDRON_ARCHIVE.oracleId,
  name: HEDRON_ARCHIVE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${HEDRON_ARCHIVE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
