// `Wistful Selkie` — the plainest ETB in the batch: draw a card. The draw
// goes through the one draw rule so an empty library still loses correctly
// (D158/D189). D270.

import { WISTFUL_SELKIE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WISTFUL_SELKIE, 'When this creature enters, draw a card.');

export const WISTFUL_SELKIE_SCRIPT: CardScript = {
  oracleId: WISTFUL_SELKIE.oracleId,
  name: WISTFUL_SELKIE.name,
  triggers: [
    {
      abilityId: 'etb-draw',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Wistful Selkie — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
