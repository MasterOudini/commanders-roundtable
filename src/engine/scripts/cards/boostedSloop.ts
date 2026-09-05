// `Boosted Sloop` - a youAttack trigger loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOOSTED_SLOOP } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(BOOSTED_SLOOP, "Menace\nWhenever you attack, draw a card, then discard a card.\nCrew 1 (Tap any number of creatures you control with total power 1 or more: This Vehicle becomes an artifact creature until end of turn.)");
const LINES = PRINTED.split('\n');

export const BOOSTED_SLOOP_SCRIPT: CardScript = {
  oracleId: BOOSTED_SLOOP.oracleId,
  name: BOOSTED_SLOOP.name,
  triggers: [
    {
      abilityId: 'youAttack-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Boosted Sloop - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Boosted Sloop - discard a card" } },
        ];
      },
    },
  ],
};
