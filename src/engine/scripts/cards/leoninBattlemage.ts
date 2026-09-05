// `Leonin Battlemage` - an activation pumpTarget, a castSpell trigger untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LEONIN_BATTLEMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LEONIN_BATTLEMAGE, "{T}: Target creature gets +1/+1 until end of turn.\nWhenever you cast a spell, you may untap this creature.");
const LINES = PRINTED.split('\n');

export const LEONIN_BATTLEMAGE_SCRIPT: CardScript = {
  oracleId: LEONIN_BATTLEMAGE.oracleId,
  name: LEONIN_BATTLEMAGE.name,
  activated: [
    {
      ref: `${LEONIN_BATTLEMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self),
      label: () => "Leonin Battlemage - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
