// `Consecrated Sphinx` - a opponentDrawsCard trigger drawN
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONSECRATED_SPHINX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONSECRATED_SPHINX, "Flying\nWhenever an opponent draws a card, you may draw two cards.");
const LINES = PRINTED.split('\n');

export const CONSECRATED_SPHINX_SCRIPT: CardScript = {
  oracleId: CONSECRATED_SPHINX.oracleId,
  name: CONSECRATED_SPHINX.name,
  triggers: [
    {
      abilityId: 'opponentDrawsCard-1',
      text: LINES[1] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player !== ctx.query.controllerOf(self),
      label: () => "Consecrated Sphinx - drawN",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 2);
      },
    },
  ],
};
