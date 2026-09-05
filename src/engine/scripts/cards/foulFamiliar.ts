// `Foul Familiar` - a static cantBlock, an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FOUL_FAMILIAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FOUL_FAMILIAR, "This creature can't block.\n{B}, Pay 1 life: Return this creature to its owner's hand.");
const LINES = PRINTED.split('\n');

export const FOUL_FAMILIAR_SCRIPT: CardScript = {
  oracleId: FOUL_FAMILIAR.oracleId,
  name: FOUL_FAMILIAR.name,
  activated: [
    {
      ref: `${FOUL_FAMILIAR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
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
