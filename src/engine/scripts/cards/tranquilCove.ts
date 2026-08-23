// `Tranquil Cove` — the refuge (Rugged Highlands D242, Jungle Hollow D183):
// tapped entry by D134's built-in, an ETB gain of 1, and the engine's mana
// line. Three printed lines, and this def claims the middle one. D261.

import { TRANQUIL_COVE } from '../../../data/fixtures/engineCards';
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
  TRANQUIL_COVE,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {W} or {U}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TRANQUIL_COVE_SCRIPT: CardScript = {
  oracleId: TRANQUIL_COVE.oracleId,
  name: TRANQUIL_COVE.name,
  triggers: [
    {
      abilityId: 'etb-gain',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Tranquil Cove — gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
