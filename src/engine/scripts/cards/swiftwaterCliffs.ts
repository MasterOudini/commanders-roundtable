// `Swiftwater Cliffs` — the refuge's THIRD id (Stark Industries,
// Subterranean Cavern): tapped built-in, the ETB gain the def claims
// (TEXT = split[1]), the mana line parsed. D256.

import { SWIFTWATER_CLIFFS } from '../../../data/fixtures/engineCards';
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
  SWIFTWATER_CLIFFS,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {U} or {R}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SWIFTWATER_CLIFFS_SCRIPT: CardScript = {
  oracleId: SWIFTWATER_CLIFFS.oracleId,
  name: SWIFTWATER_CLIFFS.name,
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
      label: () => 'Swiftwater Cliffs — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
