// `Potion of Healing` — "When this artifact enters, draw a card.\n{W}, {T},
// Sacrifice this artifact: You gain 3 life." Futurist Forge's entry draw
// (D275) with a Food-shaped tap-and-sacrifice gain. D279.

import { POTION_OF_HEALING } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  POTION_OF_HEALING,
  'When this artifact enters, draw a card.\n{W}, {T}, Sacrifice this artifact: You gain 3 life.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const GAIN = PRINTED.split('\n')[1] as string;

export const POTION_OF_HEALING_SCRIPT: CardScript = {
  oracleId: POTION_OF_HEALING.oracleId,
  name: POTION_OF_HEALING.name,
  triggers: [
    {
      abilityId: 'enters',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Potion of Healing — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => [...drawEvents(ctx.state, obj.controller, 1)],
    },
  ],
  activated: [
    {
      ref: `${POTION_OF_HEALING.oracleId}#a0`,
      text: GAIN,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
};
