// `Deep-Slumber Titan` - a static noUntap, a isDealtCombatDamage trigger untapSelf, a isDealtNoncombatDamage trigger untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEEP_SLUMBER_TITAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEEP_SLUMBER_TITAN, "This creature enters tapped.\nThis creature doesn't untap during your untap step.\nWhenever this creature is dealt damage, untap it.");
const LINES = PRINTED.split('\n');

export const DEEP_SLUMBER_TITAN_SCRIPT: CardScript = {
  oracleId: DEEP_SLUMBER_TITAN.oracleId,
  name: DEEP_SLUMBER_TITAN.name,
  triggers: [
    {
      abilityId: 'isDealtCombatDamage-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Deep-Slumber Titan - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
    {
      abilityId: 'isDealtNoncombatDamage-2',
      text: LINES[2] as string,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Deep-Slumber Titan - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'no-untap-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D323).
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
