// `Ruinous Minotaur` - a dealsDamageOpponent trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RUINOUS_MINOTAUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RUINOUS_MINOTAUR, "Whenever this creature deals damage to an opponent, sacrifice a land.");

const VOCAB_L0 = vocabularyEffects("Sacrifice a land.", RUINOUS_MINOTAUR.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice a land.");

export const RUINOUS_MINOTAUR_SCRIPT: CardScript = {
  oracleId: RUINOUS_MINOTAUR.oracleId,
  name: RUINOUS_MINOTAUR.name,
  triggers: [
    {
      abilityId: 'dealsDamageOpponent-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Ruinous Minotaur - Sacrifice a land.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'dealsDamageOpponentAny-0',
      text: PRINTED,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Ruinous Minotaur - Sacrifice a land.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
