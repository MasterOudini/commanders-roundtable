// `Body of Knowledge` - a static cdaCount, a isDealtCombatDamage trigger vocab, a isDealtNoncombatDamage trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BODY_OF_KNOWLEDGE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(BODY_OF_KNOWLEDGE, "Body of Knowledge's power and toughness are each equal to the number of cards in your hand.\nYou have no maximum hand size.\nWhenever this creature is dealt damage, draw that many cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Draw that many cards.", BODY_OF_KNOWLEDGE.name, { memo: true });
const VOCAB_T_L2 = vocabularyTargets("Draw that many cards.");

// "cards in your hand", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  return (ctx.state.zones.hand[me.controller] ?? []).length;
}


export const BODY_OF_KNOWLEDGE_SCRIPT: CardScript = {
  oracleId: BODY_OF_KNOWLEDGE.oracleId,
  name: BODY_OF_KNOWLEDGE.name,
  triggers: [
    {
      abilityId: 'isDealtCombatDamage-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.target.kind === 'card' && d.target.id === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Body of Knowledge - Draw that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'isDealtNoncombatDamage-2',
      text: LINES[2] as string,
      event: 'DamageDealt',
      activeZones: ['battlefield'],
      memo: (_ctx, self, ev) => (ev.t === 'CombatDamageDealt' || ev.t === 'DamageDealt') ? ev.damages.filter((d) => d.target.kind === 'card' && d.target.id === self).reduce((n, d) => n + d.amount, 0) : 0,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'DamageDealt' && ev.damages.some((d) => d.target.kind === 'card' && d.target.id === self && d.amount > 0),
      label: () => "Body of Knowledge - Draw that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'cda-0',
      text: LINES[0] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_0(ctx, self);
        chars.power = n;
        chars.toughness = n;
      },
    },
  ],
};
