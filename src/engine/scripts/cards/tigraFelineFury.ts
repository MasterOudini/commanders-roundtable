// `Tigra, Feline Fury` - a youGainLife trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TIGRA_FELINE_FURY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TIGRA_FELINE_FURY, "Flash\nTrample\nWhenever you gain life, put a +1/+1 counter on Tigra.");
const LINES = PRINTED.split('\n');

export const TIGRA_FELINE_FURY_SCRIPT: CardScript = {
  oracleId: TIGRA_FELINE_FURY.oracleId,
  name: TIGRA_FELINE_FURY.name,
  triggers: [
    {
      abilityId: 'youGainLife-2',
      text: LINES[2] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Tigra, Feline Fury - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
