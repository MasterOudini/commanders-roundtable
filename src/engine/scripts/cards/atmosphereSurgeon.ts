// `Atmosphere Surgeon` - a castNoncreature trigger selfCounter, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ATMOSPHERE_SURGEON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ATMOSPHERE_SURGEON, "Whenever you cast a noncreature spell, put an oil counter on this creature.\nRemove an oil counter from this creature: Target creature gains flying until end of turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

export const ATMOSPHERE_SURGEON_SCRIPT: CardScript = {
  oracleId: ATMOSPHERE_SURGEON.oracleId,
  name: ATMOSPHERE_SURGEON.name,
  activated: [
    {
      ref: `${ATMOSPHERE_SURGEON.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castNoncreature-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Atmosphere Surgeon - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 1 }] }];
      },
    },
  ],
};
