// `Veteran Guardmouse` - a becomesTargetedByYou trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VETERAN_GUARDMOUSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VETERAN_GUARDMOUSE, "Valiant — Whenever this creature becomes the target of a spell or ability you control for the first time each turn, it gets +1/+0 and gains first strike until end of turn. Scry 1. (Look at the top card of your library. You may put that card on the bottom.)");

const VOCAB_L0 = vocabularyEffects("~ gets +1/+0 and gains first strike until end of turn. Scry 1.", VETERAN_GUARDMOUSE.name);
const VOCAB_T_L0 = vocabularyTargets("~ gets +1/+0 and gains first strike until end of turn. Scry 1.");

export const VETERAN_GUARDMOUSE_SCRIPT: CardScript = {
  oracleId: VETERAN_GUARDMOUSE.oracleId,
  name: VETERAN_GUARDMOUSE.name,
  triggers: [
    {
      abilityId: 'becomesTargetedByYou-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Veteran Guardmouse - ~ gets +1/+0 and gains first strike until end of turn. Scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'becomesTargetedByYouAbility-0',
      text: PRINTED,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Veteran Guardmouse - ~ gets +1/+0 and gains first strike until end of turn. Scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
