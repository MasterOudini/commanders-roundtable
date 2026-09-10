// `Vampire Scrivener` - a youGainLife trigger selfCounter, a youLoseLife trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VAMPIRE_SCRIVENER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VAMPIRE_SCRIVENER, "Flying\nWhenever you gain life during your turn, put a +1/+1 counter on this creature.\nWhenever you lose life during your turn, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const VAMPIRE_SCRIVENER_SCRIPT: CardScript = {
  oracleId: VAMPIRE_SCRIVENER.oracleId,
  name: VAMPIRE_SCRIVENER.name,
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
      label: () => "Vampire Scrivener - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
    {
      abilityId: 'youLoseLife-2',
      text: LINES[2] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self) &&
        (ev.t === 'LifeChanged' && ev.delta < 0 && ev.player === ctx.query.controllerOf(self)),
      label: () => "Vampire Scrivener - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
