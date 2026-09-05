// `Sphinx's Disciple` - a becomesUntapped trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPHINX_S_DISCIPLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPHINX_S_DISCIPLE, "Flying\nInspired — Whenever this creature becomes untapped, draw a card.");
const LINES = PRINTED.split('\n');

export const SPHINXS_DISCIPLE_SCRIPT: CardScript = {
  oracleId: SPHINX_S_DISCIPLE.oracleId,
  name: SPHINX_S_DISCIPLE.name,
  triggers: [
    {
      abilityId: 'becomesUntapped-1',
      text: LINES[1] as string,
      event: 'PermanentsUntapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsUntapped' && ev.cards.includes(self),
      label: () => "Sphinx's Disciple - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
