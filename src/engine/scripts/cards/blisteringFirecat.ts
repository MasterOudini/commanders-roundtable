// `Blistering Firecat` - a eachEndStep trigger sacrificeSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLISTERING_FIRECAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLISTERING_FIRECAT, "Trample, haste\nAt the beginning of the end step, sacrifice this creature.\nMorph {R}{R} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

export const BLISTERING_FIRECAT_SCRIPT: CardScript = {
  oracleId: BLISTERING_FIRECAT.oracleId,
  name: BLISTERING_FIRECAT.name,
  triggers: [
    {
      abilityId: 'eachEndStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'end',
      label: () => "Blistering Firecat - sacrificeSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'graveyard', player: me.owner } }] }];
      },
    },
  ],
};
