// `Boulderborn Dragon` — "Whenever this creature attacks, surveil 1."
// Appendage Amalgam's shape behind a 'Flying, vigilance' keyword line.
// D201.

import { BOULDERBORN_DRAGON } from '../../../data/fixtures/engineCards';
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
  BOULDERBORN_DRAGON,
  'Flying, vigilance\nWhenever this creature attacks, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const BOULDERBORN_DRAGON_SCRIPT: CardScript = {
  oracleId: BOULDERBORN_DRAGON.oracleId,
  name: BOULDERBORN_DRAGON.name,
  triggers: [
    {
      abilityId: 'attacks-surveil',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Boulderborn Dragon — surveil 1',
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
