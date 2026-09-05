// `Network Terminal` - an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NETWORK_TERMINAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NETWORK_TERMINAL, "{T}: Add one mana of any color.\n{1}, {T}, Tap another untapped artifact you control: Draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

export const NETWORK_TERMINAL_SCRIPT: CardScript = {
  oracleId: NETWORK_TERMINAL.oracleId,
  name: NETWORK_TERMINAL.name,
  activated: [
    {
      ref: `${NETWORK_TERMINAL.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Network Terminal - discard a card" } },
        ];
      },
    },
  ],
};
