// `Witching Well` — a scry 2 on entry; four mana and the Well itself buy two
// cards.

import { WITCHING_WELL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  WITCHING_WELL,
  'When this artifact enters, scry 2. (Look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.)\n{3}{U}, Sacrifice this artifact: Draw two cards.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const DRAW = PRINTED.split('\n')[1] as string;

export const WITCHING_WELL_SCRIPT: CardScript = {
  oracleId: WITCHING_WELL.oracleId,
  name: WITCHING_WELL.name,
  triggers: [
    {
      abilityId: 'enters-scry',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Witching Well — scry 2',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The reveal is what makes the prompt answerable (D195): the top is
        // the END of the library array, and the answer handler validates
        // against what is revealed to the player.
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const count = Math.min(2, library.length);
        if (count === 0) return [];
        const top = library.slice(library.length - count);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count,
              toGraveyard: false,
              thenDraw: 0,
              label: 'Witching Well — scry 2',
            },
          },
        ];
      },
    },
  ],
  activated: [
    {
      ref: `${WITCHING_WELL.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
