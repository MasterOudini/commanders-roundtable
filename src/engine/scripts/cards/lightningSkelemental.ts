// `Lightning Skelemental` - a combatDamagePlayer trigger vocab, a eachEndStep trigger sacrificeSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIGHTNING_SKELEMENTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIGHTNING_SKELEMENTAL, "Trample, haste\nWhenever this creature deals combat damage to a player, that player discards two cards.\nAt the beginning of the end step, sacrifice this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player discards two cards.", LIGHTNING_SKELEMENTAL.name);
const VOCAB_T_L1 = vocabularyTargets("Target player discards two cards.");

export const LIGHTNING_SKELEMENTAL_SCRIPT: CardScript = {
  oracleId: LIGHTNING_SKELEMENTAL.oracleId,
  name: LIGHTNING_SKELEMENTAL.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (_ctx, self, ev) => ((ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? (ev.damages.find((d) => d.source === self && d.target.kind === 'player' && d.amount > 0)?.target.id ?? null) : null),
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Lightning Skelemental - Target player discards two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'eachEndStep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'end',
      label: () => "Lightning Skelemental - sacrificeSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'graveyard', player: me.owner } }] }];
      },
    },
  ],
};
