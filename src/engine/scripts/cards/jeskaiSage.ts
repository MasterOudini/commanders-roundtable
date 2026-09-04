// `Jeskai Sage` - "Prowess" (the engine's own since D308: the keyword-trigger
// table) and "When this creature dies, draw a card." - a dies trigger that
// looks back (CR 603.10) at the creature leaving the battlefield for a
// graveyard. The script claims only the printed sentence; the keyword line
// is accounted by the canon.

import { JESKAI_SAGE } from '../../../data/fixtures/engineCards';
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
  JESKAI_SAGE,
  'Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nWhen this creature dies, draw a card.',
);
const LINES = PRINTED.split('\n');

export const JESKAI_SAGE_SCRIPT: CardScript = {
  oracleId: JESKAI_SAGE.oracleId,
  name: JESKAI_SAGE.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => 'Jeskai Sage - draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
