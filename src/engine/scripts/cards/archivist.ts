// `Archivist` — "{T}: Draw a card." The simplest ActivatedDef there will ever
// be. M6.4d, D161.

import { ARCHIVIST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ARCHIVIST, '{T}: Draw a card.');

export const ARCHIVIST_SCRIPT: CardScript = {
  oracleId: ARCHIVIST.oracleId,
  name: ARCHIVIST.name,
  activated: [
    {
      ref: `${ARCHIVIST.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
