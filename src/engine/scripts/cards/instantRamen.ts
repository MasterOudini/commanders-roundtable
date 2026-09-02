// `Instant Ramen` — "Flash\nWhen this artifact enters, draw a card.\n{2},
// {T}, Sacrifice this artifact: You gain 3 life." Anchovy & Banana Pizza's
// Food-card shape (D272) with an entry draw instead of a targeted entry; the
// Flash line is the engine's keyword, the Food line is `#a0`. D276.

import { INSTANT_RAMEN } from '../../../data/fixtures/engineCards';
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
  INSTANT_RAMEN,
  'Flash\nWhen this artifact enters, draw a card.\n{2}, {T}, Sacrifice this artifact: You gain 3 life.',
);
const ENTERS = PRINTED.split('\n')[1] as string;
const FOOD = PRINTED.split('\n')[2] as string;

export const INSTANT_RAMEN_SCRIPT: CardScript = {
  oracleId: INSTANT_RAMEN.oracleId,
  name: INSTANT_RAMEN.name,
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
      label: () => 'Instant Ramen — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => [...drawEvents(ctx.state, obj.controller, 1)],
    },
  ],
  activated: [
    {
      ref: `${INSTANT_RAMEN.oracleId}#a0`,
      text: FOOD,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
};
