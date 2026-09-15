// `Phyrexian Colossus` - a static noUntap, an activation untapSelf, a static minBlockers
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHYREXIAN_COLOSSUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHYREXIAN_COLOSSUS, "This creature doesn't untap during your untap step.\nPay 8 life: Untap this creature.\nThis creature can't be blocked except by three or more creatures.");
const LINES = PRINTED.split('\n');

export const PHYREXIAN_COLOSSUS_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_COLOSSUS.oracleId,
  name: PHYREXIAN_COLOSSUS.name,
  activated: [
    {
      ref: `${PHYREXIAN_COLOSSUS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'minBlockers-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      minBlockers: (_ctx, self, attacker) => (attacker === self ? 3 : null),
    },
  ],
  replacements: [
    {
      abilityId: 'no-untap-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D371).
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
