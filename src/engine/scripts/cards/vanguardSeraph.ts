// `Vanguard Seraph` - a youGainLife trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VANGUARD_SERAPH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VANGUARD_SERAPH, "Flying\nWhenever you gain life for the first time each turn, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)");
const LINES = PRINTED.split('\n');

export const VANGUARD_SERAPH_SCRIPT: CardScript = {
  oracleId: VANGUARD_SERAPH.oracleId,
  name: VANGUARD_SERAPH.name,
  triggers: [
    {
      abilityId: 'youGainLife-1',
      text: LINES[1] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      looksBack: true,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self) && ctx.state.turn.memory.gainedLife[ev.player] !== true,
      label: () => "Vanguard Seraph - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: true, thenDraw: 0, label: "Vanguard Seraph - surveil 1" } },
        ];
      },
    },
  ],
};
