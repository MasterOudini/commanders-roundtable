// `Starfield Mystic` - a cardPutIntoGraveyard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STARFIELD_MYSTIC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STARFIELD_MYSTIC, "Enchantment spells you cast cost {1} less to cast.\nWhenever an enchantment you control is put into a graveyard from the battlefield, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const STARFIELD_MYSTIC_SCRIPT: CardScript = {
  oracleId: STARFIELD_MYSTIC.oracleId,
  name: STARFIELD_MYSTIC.name,
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
      label: () => "Starfield Mystic - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
