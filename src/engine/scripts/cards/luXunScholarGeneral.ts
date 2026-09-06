// `Lu Xun, Scholar General` - a dealsDamageOpponent trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LU_XUN_SCHOLAR_GENERAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LU_XUN_SCHOLAR_GENERAL, "Horsemanship (This creature can't be blocked except by creatures with horsemanship.)\nWhenever Lu Xun deals damage to an opponent, you may draw a card.");
const LINES = PRINTED.split('\n');

export const LU_XUN_SCHOLAR_GENERAL_SCRIPT: CardScript = {
  oracleId: LU_XUN_SCHOLAR_GENERAL.oracleId,
  name: LU_XUN_SCHOLAR_GENERAL.name,
  triggers: [
    {
      abilityId: 'dealsDamageOpponent-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Lu Xun, Scholar General - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      abilityId: 'dealsDamageOpponentAny-1',
      text: LINES[1] as string,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Lu Xun, Scholar General - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
