// `Farmstead Gleaner` - a static noUntap, an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FARMSTEAD_GLEANER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FARMSTEAD_GLEANER, "This creature doesn't untap during your untap step.\n{2}, {Q}: Put a +1/+1 counter on this creature. ({Q} is the untap symbol.)");
const LINES = PRINTED.split('\n');

export const FARMSTEAD_GLEANER_SCRIPT: CardScript = {
  oracleId: FARMSTEAD_GLEANER.oracleId,
  name: FARMSTEAD_GLEANER.name,
  activated: [
    {
      ref: `${FARMSTEAD_GLEANER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'no-untap-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D324).
      applies: (ctx, self, ev) =>
        ev.t === 'PermanentsUntapped' && ctx.state.turn.step === 'untap' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self) && ev.cards.includes(self),
      replace: (_ctx, self, ev): readonly EventBody[] => {
        if (ev.t !== 'PermanentsUntapped') return [ev];
        const cards = ev.cards.filter((c) => c !== self);
        return cards.length ? [{ t: 'PermanentsUntapped', cards }] : [];
      },
    },
  ],
};
