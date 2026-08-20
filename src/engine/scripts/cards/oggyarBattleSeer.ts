// `Oggyar Battle-Seer` — "{T}: Scry 1." The first activated scry on a
// CREATURE (Crystal Ball's ask through D159's seam; the haste line is
// Tier 2 and never counts). D229.

import { OGGYAR_BATTLE_SEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OGGYAR_BATTLE_SEER, 'Haste\n{T}: Scry 1.');
const TEXT = PRINTED.split('\n')[1] as string;

export const OGGYAR_BATTLE_SEER_SCRIPT: CardScript = {
  oracleId: OGGYAR_BATTLE_SEER.oracleId,
  name: OGGYAR_BATTLE_SEER.name,
  activated: [
    {
      ref: `${OGGYAR_BATTLE_SEER.oracleId}#a0`,
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
