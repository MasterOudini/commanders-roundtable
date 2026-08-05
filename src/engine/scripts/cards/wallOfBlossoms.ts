// `Wall of Blossoms` — `{1}{G}` 0/4, "Defender\nWhen this creature enters,
// draw a card." — Wall of Omens' green twin to the word; the reasoning lives
// there (M6.4a, D158).

import { WALL_OF_BLOSSOMS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WALL_OF_BLOSSOMS, 'Defender\nWhen this creature enters, draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const WALL_OF_BLOSSOMS_SCRIPT: CardScript = {
  oracleId: WALL_OF_BLOSSOMS.oracleId,
  name: WALL_OF_BLOSSOMS.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Wall of Blossoms — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
