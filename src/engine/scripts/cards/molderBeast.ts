// `Molder Beast` - a cardPutIntoGraveyard trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOLDER_BEAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOLDER_BEAST, "Trample\nWhenever an artifact is put into a graveyard from the battlefield, this creature gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const MOLDER_BEAST_SCRIPT: CardScript = {
  oracleId: MOLDER_BEAST.oracleId,
  name: MOLDER_BEAST.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Molder Beast - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
