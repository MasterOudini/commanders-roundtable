// `Nettle Sentinel` - a static noUntap, a castSpell trigger untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NETTLE_SENTINEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NETTLE_SENTINEL, "This creature doesn't untap during your untap step.\nWhenever you cast a green spell, you may untap this creature.");
const LINES = PRINTED.split('\n');

export const NETTLE_SENTINEL_SCRIPT: CardScript = {
  oracleId: NETTLE_SENTINEL.oracleId,
  name: NETTLE_SENTINEL.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.includes('G'),
      label: () => "Nettle Sentinel - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
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
