// `Skyclave Cleric // Skyclave Basilica` — THE FIRST MDFC SCRIPT: the
// Cleric's ETB gain on face 0, the Basilica's tapped entry and mana line
// engine-accounted on face 1. The matcher reads the FACE OFF THE MOVE
// (CardMove.faceIndex, D155) — a card played as the land back face enters
// as a Basilica and gains nobody anything. D248.

import { SKYCLAVE_CLERIC_SKYCLAVE_BASILICA } from '../../../data/fixtures/engineCards';
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
  SKYCLAVE_CLERIC_SKYCLAVE_BASILICA,
  'When this creature enters, you gain 2 life.',
);

export const SKYCLAVE_CLERIC_SCRIPT: CardScript = {
  oracleId: SKYCLAVE_CLERIC_SKYCLAVE_BASILICA.oracleId,
  name: SKYCLAVE_CLERIC_SKYCLAVE_BASILICA.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.card === self &&
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            (m.faceIndex ?? 0) === 0,
        ),
      label: () => 'Skyclave Cleric — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
