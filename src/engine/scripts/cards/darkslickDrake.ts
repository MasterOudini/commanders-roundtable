// `Darkslick Drake` — "Flying\nWhen this creature dies, draw a card." The
// dies-draw (Onulet's looksBack shape) behind an engine keyword. M6.4m, D170.

import { DARKSLICK_DRAKE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DARKSLICK_DRAKE, 'Flying\nWhen this creature dies, draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const DARKSLICK_DRAKE_SCRIPT: CardScript = {
  oracleId: DARKSLICK_DRAKE.oracleId,
  name: DARKSLICK_DRAKE.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Darkslick Drake — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
