// `Gryff Vanguard` — "When this creature enters, draw a card." Line 1 is
// Flying (Tier 2). M6.4v, D178.

import { GRYFF_VANGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRYFF_VANGUARD, 'Flying\nWhen this creature enters, draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const GRYFF_VANGUARD_SCRIPT: CardScript = {
  oracleId: GRYFF_VANGUARD.oracleId,
  name: GRYFF_VANGUARD.name,
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
      label: () => 'Gryff Vanguard — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
