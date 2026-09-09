// `Yellowjacket, Heartless Marauder` - a anotherCreatureEnters trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YELLOWJACKET_HEARTLESS_MARAUDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YELLOWJACKET_HEARTLESS_MARAUDER, "Flying\nWhenever another Villain you control enters, Yellowjacket gets +1/+0 and gains lifelink until end of turn.");
const LINES = PRINTED.split('\n');

export const YELLOWJACKET_HEARTLESS_MARAUDER_SCRIPT: CardScript = {
  oracleId: YELLOWJACKET_HEARTLESS_MARAUDER.oracleId,
  name: YELLOWJACKET_HEARTLESS_MARAUDER.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Villain'),
        ),
      label: () => "Yellowjacket, Heartless Marauder - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["lifelink"] }];
      },
    },
  ],
};
