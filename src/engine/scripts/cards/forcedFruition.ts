// `Forced Fruition` - a opponentCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FORCED_FRUITION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORCED_FRUITION, "Whenever an opponent casts a spell, that player draws seven cards.");

const VOCAB_L0 = vocabularyEffects("Target player draws seven cards.", FORCED_FRUITION.name);
const VOCAB_T_L0 = vocabularyTargets("Target player draws seven cards.");

export const FORCED_FRUITION_SCRIPT: CardScript = {
  oracleId: FORCED_FRUITION.oracleId,
  name: FORCED_FRUITION.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (_ctx, _self, ev) => (ev.t === 'SpellCast' ? ev.obj.controller : null),
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self),
      label: () => "Forced Fruition - Target player draws seven cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
