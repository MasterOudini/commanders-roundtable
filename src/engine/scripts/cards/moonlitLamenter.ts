// `Moonlit Lamenter` - a static entersWithCounters, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOONLIT_LAMENTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOONLIT_LAMENTER, "This creature enters with a -1/-1 counter on it.\n{1}{W}, Remove a counter from this creature: Draw a card. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

export const MOONLIT_LAMENTER_SCRIPT: CardScript = {
  oracleId: MOONLIT_LAMENTER.oracleId,
  name: MOONLIT_LAMENTER.name,
  activated: [
    {
      ref: `${MOONLIT_LAMENTER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "-1/-1", delta: 1 }] }],
    },
  ],
};
