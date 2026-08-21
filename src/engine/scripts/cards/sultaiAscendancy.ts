// `Sultai Ascendancy` — the upkeep surveil 2 (Geist of the Archives' shape
// at two, on an enchantment): MY upkeep only. D255.

import { SULTAI_ASCENDANCY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  SULTAI_ASCENDANCY,
  'At the beginning of your upkeep, surveil 2. (Look at the top two cards of your library, ' +
    'then put any number of them into your graveyard and the rest on top of your library in any order.)',
);

export const SULTAI_ASCENDANCY_SCRIPT: CardScript = {
  oracleId: SULTAI_ASCENDANCY.oracleId,
  name: SULTAI_ASCENDANCY.name,
  triggers: [
    {
      abilityId: 'upkeep-surveil',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'upkeep' &&
        ctx.state.turn.activePlayer === ctx.state.cards[self]?.controller,
      label: () => 'Sultai Ascendancy — surveil 2',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: true,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
