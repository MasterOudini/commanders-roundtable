// `Mossdog` - a becomesTargetedByOpponent trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOSSDOG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOSSDOG, "Whenever this creature becomes the target of a spell or ability an opponent controls, put a +1/+1 counter on this creature.");

export const MOSSDOG_SCRIPT: CardScript = {
  oracleId: MOSSDOG.oracleId,
  name: MOSSDOG.name,
  triggers: [
    {
      abilityId: 'becomesTargetedByOpponent-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Mossdog - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
    {
      abilityId: 'becomesTargetedByOpponentAbility-0',
      text: PRINTED,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.controller !== ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Mossdog - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
