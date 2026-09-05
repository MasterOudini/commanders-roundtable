// `Carrion Feeder` - a static cantBlock, an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CARRION_FEEDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CARRION_FEEDER, "This creature can't block.\nSacrifice a creature: Put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const CARRION_FEEDER_SCRIPT: CardScript = {
  oracleId: CARRION_FEEDER.oracleId,
  name: CARRION_FEEDER.name,
  activated: [
    {
      ref: `${CARRION_FEEDER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
