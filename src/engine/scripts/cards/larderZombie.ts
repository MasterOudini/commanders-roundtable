// `Larder Zombie` — Defender is the engine's; tapping three untapped
// creatures I control (the D286 tap chooser) is a surveil 1: the top card
// revealed to me, then the scry ask with the graveyard as the away pile.

import { LARDER_ZOMBIE } from '../../../data/fixtures/engineCards';
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
  LARDER_ZOMBIE,
  'Defender\nTap three untapped creatures you control: Surveil 1. (Look at the top card of your library. You may put that card into your graveyard.)',
);
const SURVEIL = PRINTED.split('\n')[1] as string;

export const LARDER_ZOMBIE_SCRIPT: CardScript = {
  oracleId: LARDER_ZOMBIE.oracleId,
  name: LARDER_ZOMBIE.name,
  activated: [
    {
      ref: `${LARDER_ZOMBIE.oracleId}#a0`,
      text: SURVEIL,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        if (library.length === 0) return [];
        return [
          { t: 'CardsRevealed', cards: library.slice(library.length - 1), to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: { kind: 'scryChoice', player: obj.controller, count: 1, toGraveyard: true, thenDraw: 0, label: obj.label },
          },
        ];
      },
    },
  ],
};
