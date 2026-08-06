// `Dawnhart Rejuvenator` — "When this creature enters, you gain 3 life.\n{T}:
// Add one mana of any color." The trigger is the def's; the mana line is the
// ENGINE's (CR 605, never on the stack) — Dawnhart's shape of Commander's
// Sphere's split. M6.4m, D170.

import { DAWNHART_REJUVENATOR } from '../../../data/fixtures/engineCards';
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
  DAWNHART_REJUVENATOR,
  'When this creature enters, you gain 3 life.\n{T}: Add one mana of any color.',
);
const TEXT = PRINTED.split('\n')[0] as string;

export const DAWNHART_REJUVENATOR_SCRIPT: CardScript = {
  oracleId: DAWNHART_REJUVENATOR.oracleId,
  name: DAWNHART_REJUVENATOR.name,
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
      label: () => 'Dawnhart Rejuvenator — you gain 3 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 }];
      },
    },
  ],
};
