// `Basim Ibn Ishaq` - a castSpell trigger vocab, a combatDamagePlayer trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BASIM_IBN_ISHAQ } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(BASIM_IBN_ISHAQ, "Whenever you cast a historic spell, draw a card. Basim Ibn Ishaq can't be blocked this turn. This ability triggers only once each turn. (Artifacts, legendaries, and Sagas are historic.)\nWhenever Basim Ibn Ishaq deals combat damage to a player, put a +1/+1 counter on it.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Draw a card. ~ can't be blocked this turn.", BASIM_IBN_ISHAQ.name);
const VOCAB_T_L0 = vocabularyTargets("Draw a card. ~ can't be blocked this turn.");

export const BASIM_IBN_ISHAQ_SCRIPT: CardScript = {
  oracleId: BASIM_IBN_ISHAQ.oracleId,
  name: BASIM_IBN_ISHAQ.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).typeLine.types.includes('Artifact') || ctx.derive(ev.obj.card).typeLine.supertypes.includes('Legendary') || ctx.derive(ev.obj.card).typeLine.subtypes.includes('Saga')),
      label: () => "Basim Ibn Ishaq - Draw a card. ~ can't be blocked this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Basim Ibn Ishaq - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
