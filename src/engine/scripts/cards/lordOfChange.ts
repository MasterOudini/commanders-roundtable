// `Lord of Change` - a etb trigger drawN
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LORD_OF_CHANGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LORD_OF_CHANGE, "Flying, ward {3}\nArchitect of Deception — When this creature enters, draw three cards.");
const LINES = PRINTED.split('\n');

export const LORD_OF_CHANGE_SCRIPT: CardScript = {
  oracleId: LORD_OF_CHANGE.oracleId,
  name: LORD_OF_CHANGE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Lord of Change - drawN",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 3);
      },
    },
  ],
};
