// `Mantle of Leadership` - a anyCreatureEnters trigger attachedTemp
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MANTLE_OF_LEADERSHIP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MANTLE_OF_LEADERSHIP, "Flash (You may cast this spell any time you could cast an instant.)\nEnchant creature\nWhenever a creature enters, enchanted creature gets +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const MANTLE_OF_LEADERSHIP_SCRIPT: CardScript = {
  oracleId: MANTLE_OF_LEADERSHIP.oracleId,
  name: MANTLE_OF_LEADERSHIP.name,
  triggers: [
    {
      abilityId: 'anyCreatureEnters-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Mantle of Leadership - attachedTemp",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: host, power: 2, toughness: 2 }];
      },
    },
  ],
};
