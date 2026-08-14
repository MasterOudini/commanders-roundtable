// `Jayemdae Tome` — "{4}, {T}: Draw a card." Arcane Encyclopedia's EXACT
// text on a second oracle id — the Benalish precedent reaching back to
// D159's very first activated def. M6.4z, D182.

import { JAYEMDAE_TOME } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(JAYEMDAE_TOME, '{4}, {T}: Draw a card.');

export const JAYEMDAE_TOME_SCRIPT: CardScript = {
  oracleId: JAYEMDAE_TOME.oracleId,
  name: JAYEMDAE_TOME.name,
  activated: [
    {
      ref: `${JAYEMDAE_TOME.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
