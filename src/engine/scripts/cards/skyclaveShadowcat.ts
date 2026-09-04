// `Skyclave Shadowcat` - "{1}{B}, Sacrifice another creature: Put a +1/+1 counter
// on this creature." (D303's self counter; the cost is the engine's) and "Whenever
// a creature you control with a +1/+1 counter on it dies, draw a card." - a dies
// watcher that looks back (CR 603.10) at the counters the creature carried.

import { SKYCLAVE_SHADOWCAT } from '../../../data/fixtures/engineCards';
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
  SKYCLAVE_SHADOWCAT,
  '{1}{B}, Sacrifice another creature: Put a +1/+1 counter on this creature.\nWhenever a creature you control with a +1/+1 counter on it dies, draw a card.',
);
const LINES = PRINTED.split('\n');

export const SKYCLAVE_SHADOWCAT_SCRIPT: CardScript = {
  oracleId: SKYCLAVE_SHADOWCAT.oracleId,
  name: SKYCLAVE_SHADOWCAT.name,
  activated: [
    {
      ref: `${SKYCLAVE_SHADOWCAT.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          if ((inst.counters['+1/+1'] ?? 0) < 1) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        }),
      label: () => 'Skyclave Shadowcat - draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
