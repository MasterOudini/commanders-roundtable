// `Rushwood Elemental` - a upkeep trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RUSHWOOD_ELEMENTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RUSHWOOD_ELEMENTAL, "Trample\nAt the beginning of your upkeep, you may put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const RUSHWOOD_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: RUSHWOOD_ELEMENTAL.oracleId,
  name: RUSHWOOD_ELEMENTAL.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Rushwood Elemental - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
