// `Longtusk Cub` - a combatDamagePlayer trigger vocab, an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LONGTUSK_CUB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LONGTUSK_CUB, "Whenever this creature deals combat damage to a player, you get {E}{E} (two energy counters).\nPay {E}{E}: Put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}{E}.", LONGTUSK_CUB.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}{E}.");

export const LONGTUSK_CUB_SCRIPT: CardScript = {
  oracleId: LONGTUSK_CUB.oracleId,
  name: LONGTUSK_CUB.name,
  activated: [
    {
      ref: `${LONGTUSK_CUB.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
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
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Longtusk Cub - You get {E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
