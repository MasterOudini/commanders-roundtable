// `Citanul Druid` - a opponentCastsSpell trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CITANUL_DRUID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CITANUL_DRUID, "Whenever an opponent casts an artifact spell, put a +1/+1 counter on this creature.");

export const CITANUL_DRUID_SCRIPT: CardScript = {
  oracleId: CITANUL_DRUID.oracleId,
  name: CITANUL_DRUID.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.types.includes('Artifact'),
      label: () => "Citanul Druid - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
