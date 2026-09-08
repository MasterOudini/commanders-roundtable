// `Hunting Cheetah` - a dealsDamageOpponent trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HUNTING_CHEETAH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HUNTING_CHEETAH, "Whenever this creature deals damage to an opponent, you may search your library for a Forest card, reveal that card, put it into your hand, then shuffle.");

const VOCAB_L0 = vocabularyEffects("Search your library for a Forest card, reveal that card, put it into your hand, then shuffle.", HUNTING_CHEETAH.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a Forest card, reveal that card, put it into your hand, then shuffle.");

export const HUNTING_CHEETAH_SCRIPT: CardScript = {
  oracleId: HUNTING_CHEETAH.oracleId,
  name: HUNTING_CHEETAH.name,
  triggers: [
    {
      abilityId: 'dealsDamageOpponent-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Hunting Cheetah - Search your library for a Forest card, reveal that card, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'dealsDamageOpponentAny-0',
      text: PRINTED,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.target.id !== ctx.query.controllerOf(self) && d.amount > 0),
      label: () => "Hunting Cheetah - Search your library for a Forest card, reveal that card, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
