// `Library Larcenist` — "Whenever this creature attacks, draw a card."
// Herald of Faith's self-attack watcher paying in cards. M6.4ac, D185.

import { LIBRARY_LARCENIST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LIBRARY_LARCENIST, 'Whenever this creature attacks, draw a card.');

export const LIBRARY_LARCENIST_SCRIPT: CardScript = {
  oracleId: LIBRARY_LARCENIST.oracleId,
  name: LIBRARY_LARCENIST.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Library Larcenist — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
