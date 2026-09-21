// `Emberheart Challenger` - a becomesTargetedByYou trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMBERHEART_CHALLENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMBERHEART_CHALLENGER, "Haste\nProwess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nValiant — Whenever this creature becomes the target of a spell or ability you control for the first time each turn, exile the top card of your library. Until end of turn, you may play that card.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Exile the top card of your library. Until end of turn, you may play that card.", EMBERHEART_CHALLENGER.name);
const VOCAB_T_L2 = vocabularyTargets("Exile the top card of your library. Until end of turn, you may play that card.");

export const EMBERHEART_CHALLENGER_SCRIPT: CardScript = {
  oracleId: EMBERHEART_CHALLENGER.oracleId,
  name: EMBERHEART_CHALLENGER.name,
  triggers: [
    {
      abilityId: 'becomesTargetedByYou-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Emberheart Challenger - Exile the top card of your library. Until end of turn, you may play that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'becomesTargetedByYouAbility-2',
      text: LINES[2] as string,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Emberheart Challenger - Exile the top card of your library. Until end of turn, you may play that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
