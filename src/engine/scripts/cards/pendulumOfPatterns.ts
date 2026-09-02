// `Pendulum of Patterns` — "When this artifact enters, you gain 3 life.\n
// {5}, {T}, Sacrifice this artifact: Draw a card." A self-entry gain and the
// Cluestone sacrifice-draw (D163), tap and sacrifice charged at activation.
// D278.

import { PENDULUM_OF_PATTERNS } from '../../../data/fixtures/engineCards';
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
  PENDULUM_OF_PATTERNS,
  'When this artifact enters, you gain 3 life.\n{5}, {T}, Sacrifice this artifact: Draw a card.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const DRAW = PRINTED.split('\n')[1] as string;

export const PENDULUM_OF_PATTERNS_SCRIPT: CardScript = {
  oracleId: PENDULUM_OF_PATTERNS.oracleId,
  name: PENDULUM_OF_PATTERNS.name,
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
      label: () => 'Pendulum of Patterns — you gain 3 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
  activated: [
    {
      ref: `${PENDULUM_OF_PATTERNS.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
