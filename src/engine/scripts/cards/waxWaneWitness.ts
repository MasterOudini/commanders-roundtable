// `Wax-Wane Witness` - a youGainLife trigger pumping itself, a youLoseLife trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WAX_WANE_WITNESS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WAX_WANE_WITNESS, "Flying, vigilance\nWhenever you gain or lose life during your turn, this creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const WAX_WANE_WITNESS_SCRIPT: CardScript = {
  oracleId: WAX_WANE_WITNESS.oracleId,
  name: WAX_WANE_WITNESS.name,
  triggers: [
    {
      abilityId: 'youGainLife-1',
      text: LINES[1] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self) &&
        (ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self)),
      label: () => "Wax-Wane Witness - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
    {
      abilityId: 'youLoseLife-1',
      text: LINES[1] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self) &&
        (ev.t === 'LifeChanged' && ev.delta < 0 && ev.player === ctx.query.controllerOf(self)),
      label: () => "Wax-Wane Witness - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
