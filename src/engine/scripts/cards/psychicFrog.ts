// `Psychic Frog` - a combatDamagePlayer trigger draw, an activation selfCounter, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PSYCHIC_FROG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PSYCHIC_FROG, "Whenever this creature deals combat damage to a player or planeswalker, draw a card.\nDiscard a card: Put a +1/+1 counter on this creature.\nExile three cards from your graveyard: This creature gains flying until end of turn.");
const LINES = PRINTED.split('\n');

export const PSYCHIC_FROG_SCRIPT: CardScript = {
  oracleId: PSYCHIC_FROG.oracleId,
  name: PSYCHIC_FROG.name,
  activated: [
    {
      ref: `${PSYCHIC_FROG.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
    {
      ref: `${PSYCHIC_FROG.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'combatDamagePlayer-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.amount > 0 && (d.target.kind === 'player' || (d.target.kind === 'card' && ctx.derive(d.target.id).typeLine.types.includes('Planeswalker')))),
      label: () => "Psychic Frog - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
