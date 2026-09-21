// `Whiskerquill Scribe` - a becomesTargetedByYou trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WHISKERQUILL_SCRIBE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WHISKERQUILL_SCRIBE, "Valiant — Whenever this creature becomes the target of a spell or ability you control for the first time each turn, you may discard a card. If you do, draw a card.");

const VOCAB_L0 = vocabularyEffects("You may discard a card. If you do, draw a card.", WHISKERQUILL_SCRIBE.name);
const VOCAB_T_L0 = vocabularyTargets("You may discard a card. If you do, draw a card.");

export const WHISKERQUILL_SCRIBE_SCRIPT: CardScript = {
  oracleId: WHISKERQUILL_SCRIBE.oracleId,
  name: WHISKERQUILL_SCRIBE.name,
  triggers: [
    {
      abilityId: 'becomesTargetedByYou-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Whiskerquill Scribe - You may discard a card. If you do, draw a card.",
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
      label: () => "Whiskerquill Scribe - You may discard a card. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
