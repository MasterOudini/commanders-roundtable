// `Viashino Sandstalker` - a eachEndStep trigger bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIASHINO_SANDSTALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIASHINO_SANDSTALKER, "Haste (This creature can attack and {T} as soon as it comes under your control.)\nAt the beginning of the end step, return this creature to its owner's hand. (Return it only if it's on the battlefield.)");
const LINES = PRINTED.split('\n');

export const VIASHINO_SANDSTALKER_SCRIPT: CardScript = {
  oracleId: VIASHINO_SANDSTALKER.oracleId,
  name: VIASHINO_SANDSTALKER.name,
  triggers: [
    {
      abilityId: 'eachEndStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'end',
      label: () => "Viashino Sandstalker - bounceSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
