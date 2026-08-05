// `Arborback Stomper` — "Trample\nWhen this creature enters, you gain 5 life."
// M6.4d, D161.

import { ARBORBACK_STOMPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARBORBACK_STOMPER, 'Trample\nWhen this creature enters, you gain 5 life.');
const TEXT = PRINTED.split('\n')[1] as string;

export const ARBORBACK_STOMPER_SCRIPT: CardScript = {
  oracleId: ARBORBACK_STOMPER.oracleId,
  name: ARBORBACK_STOMPER.name,
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
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Arborback Stomper — gain 5 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 5, to: player.life + 5 }];
      },
    },
  ],
};
