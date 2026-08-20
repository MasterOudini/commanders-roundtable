// `Moonfolk Puzzlemaker` — "Whenever this creature becomes tapped, scry 1."
// Emmara's becomes-tapped SELF watcher raising the D195 ask (toGraveyard
// false — a scry bottoms, never buries). D226.

import { MOONFOLK_PUZZLEMAKER } from '../../../data/fixtures/engineCards';
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
  MOONFOLK_PUZZLEMAKER,
  'Flying\nWhenever this creature becomes tapped, scry 1.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const MOONFOLK_PUZZLEMAKER_SCRIPT: CardScript = {
  oracleId: MOONFOLK_PUZZLEMAKER.oracleId,
  name: MOONFOLK_PUZZLEMAKER.name,
  triggers: [
    {
      abilityId: 'tapped-scry',
      text: TEXT,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => 'Moonfolk Puzzlemaker — scry 1',
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
