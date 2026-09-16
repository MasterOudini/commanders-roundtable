// `Bloodline Pretender` - a anotherCreatureEnters trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOODLINE_PRETENDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOODLINE_PRETENDER, "Changeling (This card is every creature type.)\nAs this creature enters, choose a creature type.\nWhenever another creature you control of the chosen type enters, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const BLOODLINE_PRETENDER_SCRIPT: CardScript = {
  oracleId: BLOODLINE_PRETENDER.oracleId,
  name: BLOODLINE_PRETENDER.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && ctx.derive(m.card).typeLine.subtypes.includes(ctx.state.cards[self]?.chosenType ?? ''),
        ),
      label: () => "Bloodline Pretender - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
