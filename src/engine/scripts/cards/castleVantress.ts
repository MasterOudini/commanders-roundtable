// `Castle Vantress` — "{2}{U}{U}, {T}: Scry 2." The FIRST activated scry:
// the ActivatedDef resolve emits the same reveal-then-ask pair a trigger
// does (Temple's emission through D159's seam). The enters-tapped-unless
// line is D135's built-in and the mana line is the engine's parse — the
// def claims the scry line only. D202.

import { CASTLE_VANTRESS } from '../../../data/fixtures/engineCards';
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
  CASTLE_VANTRESS,
  'This land enters tapped unless you control an Island.\n{T}: Add {U}.\n{2}{U}{U}, {T}: Scry 2.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const CASTLE_VANTRESS_SCRIPT: CardScript = {
  oracleId: CASTLE_VANTRESS.oracleId,
  name: CASTLE_VANTRESS.name,
  activated: [
    {
      // #a1: the mana line is ability 0 in printed order; the scry is second.
      ref: `${CASTLE_VANTRESS.oracleId}#a1`,
      text: TEXT,
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
