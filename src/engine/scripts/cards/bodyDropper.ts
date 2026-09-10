// `Body Dropper` - a youSacrifice trigger selfCounter, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BODY_DROPPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BODY_DROPPER, "Whenever you sacrifice another creature, put a +1/+1 counter on this creature.\n{B}{R}, Sacrifice another creature: This creature gains menace until end of turn. (It can't be blocked except by two or more creatures.)");
const LINES = PRINTED.split('\n');

export const BODY_DROPPER_SCRIPT: CardScript = {
  oracleId: BODY_DROPPER.oracleId,
  name: BODY_DROPPER.name,
  activated: [
    {
      ref: `${BODY_DROPPER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["menace"] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'youSacrifice-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'sacrifice' && m.card !== self && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Body Dropper - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
