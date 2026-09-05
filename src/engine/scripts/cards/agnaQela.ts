// `Agna Qel'a` - an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AGNA_QEL_A } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AGNA_QEL_A, "This land enters tapped unless you control a basic land.\n{T}: Add {U}.\n{2}{U}, {T}: Draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

export const AGNA_QELA_SCRIPT: CardScript = {
  oracleId: AGNA_QEL_A.oracleId,
  name: AGNA_QEL_A.name,
  activated: [
    {
      ref: `${AGNA_QEL_A.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Agna Qel'a - discard a card" } },
        ];
      },
    },
  ],
};
