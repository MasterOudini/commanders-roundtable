// `Arcane Encyclopedia` — `{3}` Artifact, "{3}, {T}: Draw a card." — the first
// SHIPPED ActivatedDef (M6.4b, D159): the engine has parsed, offered and
// charged this shape since M3 and resolved it to nothing (D122); the def is
// the effect that was missing.

import { ARCANE_ENCYCLOPEDIA } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ARCANE_ENCYCLOPEDIA, '{3}, {T}: Draw a card.');

export const ARCANE_ENCYCLOPEDIA_SCRIPT: CardScript = {
  oracleId: ARCANE_ENCYCLOPEDIA.oracleId,
  name: ARCANE_ENCYCLOPEDIA.name,
  activated: [
    {
      // ⚠️ `#a0` — the card's ONLY ability line, so the parsed index is 0. The
      // ref is the join `handlers.activateAbility` writes and `resolveAbility`
      // looks up; a wrong index is a def that looks landed and runs never,
      // which is why the per-card test activates through the real intent.
      ref: `${ARCANE_ENCYCLOPEDIA.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
