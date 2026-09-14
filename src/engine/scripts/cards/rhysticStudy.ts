// `Rhystic Study` - a opponentCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RHYSTIC_STUDY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RHYSTIC_STUDY, "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.");

const VOCAB_L0 = vocabularyEffects("Draw a card unless target player pays {1}.", RHYSTIC_STUDY.name);
const VOCAB_T_L0 = vocabularyTargets("Draw a card unless target player pays {1}.");

export const RHYSTIC_STUDY_SCRIPT: CardScript = {
  oracleId: RHYSTIC_STUDY.oracleId,
  name: RHYSTIC_STUDY.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      playerOf: (_ctx, _self, ev) => (ev.t === 'SpellCast' ? ev.obj.controller : null),
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self),
      label: () => "Rhystic Study - Draw a card unless target player pays {1}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
