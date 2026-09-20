// `Warren Instigator` - a dealsDamageOpponent trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WARREN_INSTIGATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WARREN_INSTIGATOR, "Double strike\nWhenever this creature deals damage to an opponent, you may put a Goblin creature card from your hand onto the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a Goblin creature card from your hand onto the battlefield.", WARREN_INSTIGATOR.name);
const VOCAB_T_L1 = vocabularyTargets("Put a Goblin creature card from your hand onto the battlefield.");

export const WARREN_INSTIGATOR_SCRIPT: CardScript = {
  oracleId: WARREN_INSTIGATOR.oracleId,
  name: WARREN_INSTIGATOR.name,
  triggers: [
    {
      abilityId: 'dealsDamageOpponent-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Warren Instigator - Put a Goblin creature card from your hand onto the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'dealsDamageOpponentAny-1',
      text: LINES[1] as string,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Warren Instigator - Put a Goblin creature card from your hand onto the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
