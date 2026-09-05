// `Furtive Analyst` - an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FURTIVE_ANALYST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FURTIVE_ANALYST, "Vigilance\n{2}, {T}: Draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

export const FURTIVE_ANALYST_SCRIPT: CardScript = {
  oracleId: FURTIVE_ANALYST.oracleId,
  name: FURTIVE_ANALYST.name,
  activated: [
    {
      ref: `${FURTIVE_ANALYST.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Furtive Analyst - discard a card" } },
        ];
      },
    },
  ],
};
