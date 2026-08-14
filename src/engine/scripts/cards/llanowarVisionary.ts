// `Llanowar Visionary` — "When this creature enters, draw a card." The ETB
// line comes FIRST; the mana line under it is the engine's. M6.4ac, D185.

import { LLANOWAR_VISIONARY } from '../../../data/fixtures/engineCards';
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
  LLANOWAR_VISIONARY,
  'When this creature enters, draw a card.\n{T}: Add {G}.',
);
const TEXT = PRINTED.split('\n')[0] as string;

export const LLANOWAR_VISIONARY_SCRIPT: CardScript = {
  oracleId: LLANOWAR_VISIONARY.oracleId,
  name: LLANOWAR_VISIONARY.name,
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
      label: () => 'Llanowar Visionary — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
