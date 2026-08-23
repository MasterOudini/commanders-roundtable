// `Umbral Collar Zealot` — the OR-predicate 'another' sacrifice chooser
// (D168) paying a surveil ask (D195). No mana in the cost: the sacrifice IS
// the price, Aura Fracture's shape (D169).
//
// ⚠️ 'ANOTHER creature or artifact' means the Zealot can never eat itself,
// which the engine's own candidate builder enforces — this def only says what
// the ability does. D263.

import { UMBRAL_COLLAR_ZEALOT } from '../../../data/fixtures/engineCards';
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
  UMBRAL_COLLAR_ZEALOT,
  'Sacrifice another creature or artifact: Surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);

export const UMBRAL_COLLAR_ZEALOT_SCRIPT: CardScript = {
  oracleId: UMBRAL_COLLAR_ZEALOT.oracleId,
  name: UMBRAL_COLLAR_ZEALOT.name,
  activated: [
    {
      ref: `${UMBRAL_COLLAR_ZEALOT.oracleId}#a0`,
      text: TEXT,
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
