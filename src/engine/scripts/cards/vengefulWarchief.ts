// `Vengeful Warchief` - a youLoseLife trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VENGEFUL_WARCHIEF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VENGEFUL_WARCHIEF, "Whenever you lose life for the first time each turn, put a +1/+1 counter on this creature. (Damage causes loss of life.)");

export const VENGEFUL_WARCHIEF_SCRIPT: CardScript = {
  oracleId: VENGEFUL_WARCHIEF.oracleId,
  name: VENGEFUL_WARCHIEF.name,
  triggers: [
    {
      abilityId: 'youLoseLife-0',
      text: PRINTED,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      looksBack: true,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta < 0 && ev.player === ctx.query.controllerOf(self) && ctx.state.turn.memory.lostLife[ev.player] !== true,
      label: () => "Vengeful Warchief - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
