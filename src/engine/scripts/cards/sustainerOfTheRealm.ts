// `Sustainer of the Realm` - a blocks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUSTAINER_OF_THE_REALM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUSTAINER_OF_THE_REALM, "Flying\nWhenever this creature blocks, it gets +0/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const SUSTAINER_OF_THE_REALM_SCRIPT: CardScript = {
  oracleId: SUSTAINER_OF_THE_REALM.oracleId,
  name: SUSTAINER_OF_THE_REALM.name,
  triggers: [
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Sustainer of the Realm - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 2 }];
      },
    },
  ],
};
