// `Brushfire Elemental` - a static cantBeBlockedByPower, a landfall trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRUSHFIRE_ELEMENTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRUSHFIRE_ELEMENTAL, "Haste\nThis creature can't be blocked by creatures with power 2 or less.\nLandfall — Whenever a land you control enters, this creature gets +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const BRUSHFIRE_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: BRUSHFIRE_ELEMENTAL.oracleId,
  name: BRUSHFIRE_ELEMENTAL.name,
  triggers: [
    {
      abilityId: 'landfall-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Brushfire Elemental - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 2,
    },
  ],
};
