// `Glistener Seer` - a static entersWithCounters, an activation scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLISTENER_SEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLISTENER_SEER, "This creature enters with three oil counters on it.\n{T}, Remove an oil counter from this creature: Scry 1. (Look at the top card of your library. You may put that card on the bottom.)");
const LINES = PRINTED.split('\n');

export const GLISTENER_SEER_SCRIPT: CardScript = {
  oracleId: GLISTENER_SEER.oracleId,
  name: GLISTENER_SEER.name,
  activated: [
    {
      ref: `${GLISTENER_SEER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Glistener Seer - scry 1" } },
        ];
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
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 3 }] }],
    },
  ],
};
