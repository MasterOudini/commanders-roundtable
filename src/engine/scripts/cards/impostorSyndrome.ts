// `Impostor Syndrome` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IMPOSTOR_SYNDROME } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IMPOSTOR_SYNDROME, "Whenever a nontoken creature you control deals combat damage to a player, create a token that's a copy of it, except it isn't legendary.");

const VOCAB_L0 = vocabularyEffects("Create a token that's a copy of target creature, except it isn't legendary.", IMPOSTOR_SYNDROME.name);
const VOCAB_T_L0 = vocabularyTargets("Create a token that's a copy of target creature, except it isn't legendary.");

export const IMPOSTOR_SYNDROME_SCRIPT: CardScript = {
  oracleId: IMPOSTOR_SYNDROME.oracleId,
  name: IMPOSTOR_SYNDROME.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Creature') && !ctx.state.cards[d.source]?.isToken).map((d) => d.source))] : [],
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Creature') && !ctx.state.cards[d.source]?.isToken),
      label: () => "Impostor Syndrome - Create a token that's a copy of target creature, except it isn't legendary.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
