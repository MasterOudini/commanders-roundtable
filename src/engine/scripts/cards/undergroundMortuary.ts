// `Underground Mortuary` — the reminder-FIRST surveil land: the mana reminder is printed
// ABOVE the other two lines, so the trigger is `split[2]` and not
// `split[1]` (D237's Raucous Theater, and D260's Thundering Falls is the
// shipped member of this exact shape). The tapped entry is D134's built-in
// and the mana line the engine's; this def claims the trigger alone. D263.

import { UNDERGROUND_MORTUARY } from '../../../data/fixtures/engineCards';
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
  UNDERGROUND_MORTUARY,
  '({T}: Add {B} or {G}.)\nThis land enters tapped.\nWhen this land enters, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const UNDERGROUND_MORTUARY_SCRIPT: CardScript = {
  oracleId: UNDERGROUND_MORTUARY.oracleId,
  name: UNDERGROUND_MORTUARY.name,
  triggers: [
    {
      abilityId: 'etb-surveil',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Underground Mortuary — surveil 1',
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
