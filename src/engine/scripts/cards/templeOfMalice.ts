// `Temple of Malice` — the first SCRY TRIGGER: "When this land enters,
// scry 1." The def's resolve emits the SAME reveal-then-ask pair the D195
// effect emits — the answer handler derives everything from `revealedTo`,
// so nothing cares what raised the prompt. The enters-tapped line is
// D134's built-in and the mana line is the engine's; this def claims only
// the trigger. D196.

import { TEMPLE_OF_MALICE } from '../../../data/fixtures/engineCards';
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
  TEMPLE_OF_MALICE,
  'This land enters tapped.\nWhen this land enters, scry 1. (Look at the top card of your library. You may put that card on the bottom.)\n{T}: Add {B} or {R}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TEMPLE_OF_MALICE_SCRIPT: CardScript = {
  oracleId: TEMPLE_OF_MALICE.oracleId,
  name: TEMPLE_OF_MALICE.name,
  triggers: [
    {
      abilityId: 'etb-scry',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Temple of Malice — scry 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
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
              toGraveyard: false,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
