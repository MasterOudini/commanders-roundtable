// `Zephyr Scribe` - an activation loot, a castNoncreature trigger untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZEPHYR_SCRIBE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZEPHYR_SCRIBE, "{U}, {T}: Draw a card, then discard a card.\nWhenever you cast a noncreature spell, untap this creature.");
const LINES = PRINTED.split('\n');

export const ZEPHYR_SCRIBE_SCRIPT: CardScript = {
  oracleId: ZEPHYR_SCRIBE.oracleId,
  name: ZEPHYR_SCRIBE.name,
  activated: [
    {
      ref: `${ZEPHYR_SCRIBE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Zephyr Scribe - discard a card" } },
        ];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castNoncreature-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Zephyr Scribe - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
