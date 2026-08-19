// `Meltstrider Eulogist` — "Whenever a creature you control with a +1/+1
// counter on it dies, draw a card." The FIRST counter-conditioned dies
// watcher: the mover's counters are read off the BEFORE state the way Field
// of Souls reads `isToken` — `looksBack` hands `matches` the board the
// creature died on, counters still on it. Self-inclusive by the printed
// wording. M6.4ad, D186.

import { MELTSTRIDER_EULOGIST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  MELTSTRIDER_EULOGIST,
  'Whenever a creature you control with a +1/+1 counter on it dies, draw a card.',
);

export const MELTSTRIDER_EULOGIST_SCRIPT: CardScript = {
  oracleId: MELTSTRIDER_EULOGIST.oracleId,
  name: MELTSTRIDER_EULOGIST.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || (inst.counters['+1/+1'] ?? 0) <= 0) return false;
          if (ctx.query.controllerOf(m.card) !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        }),
      label: () => 'Meltstrider Eulogist — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
