// `Mouse Trapper` - a becomesTargetedByYou trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOUSE_TRAPPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOUSE_TRAPPER, "Flash\nValiant — Whenever this creature becomes the target of a spell or ability you control for the first time each turn, tap target creature an opponent controls.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Tap target creature an opponent controls.", MOUSE_TRAPPER.name);
const VOCAB_T_L1 = vocabularyTargets("Tap target creature an opponent controls.");

export const MOUSE_TRAPPER_SCRIPT: CardScript = {
  oracleId: MOUSE_TRAPPER.oracleId,
  name: MOUSE_TRAPPER.name,
  triggers: [
    {
      abilityId: 'becomesTargetedByYou-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Mouse Trapper - Tap target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'becomesTargetedByYouAbility-1',
      text: LINES[1] as string,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Mouse Trapper - Tap target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
