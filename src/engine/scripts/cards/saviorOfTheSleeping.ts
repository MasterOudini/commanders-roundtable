// `Savior of the Sleeping` - a cardPutIntoGraveyard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAVIOR_OF_THE_SLEEPING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAVIOR_OF_THE_SLEEPING, "Vigilance\nWhenever an enchantment you control is put into a graveyard from the battlefield, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const SAVIOR_OF_THE_SLEEPING_SCRIPT: CardScript = {
  oracleId: SAVIOR_OF_THE_SLEEPING.oracleId,
  name: SAVIOR_OF_THE_SLEEPING.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Enchantment'),
        ),
      label: () => "Savior of the Sleeping - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
