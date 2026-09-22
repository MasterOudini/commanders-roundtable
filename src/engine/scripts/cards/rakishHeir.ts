// `Rakish Heir` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAKISH_HEIR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAKISH_HEIR, "Whenever a Vampire you control deals combat damage to a player, put a +1/+1 counter on it.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target creature.", RAKISH_HEIR.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target creature.");

export const RAKISH_HEIR_SCRIPT: CardScript = {
  oracleId: RAKISH_HEIR.oracleId,
  name: RAKISH_HEIR.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.subtypes.includes('Vampire')).map((d) => d.source))] : [],
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.subtypes.includes('Vampire')),
      label: () => "Rakish Heir - Put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
