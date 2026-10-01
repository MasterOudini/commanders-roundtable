// `Gleam of Battle` - a creatureYouControlAttacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLEAM_OF_BATTLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLEAM_OF_BATTLE, "Whenever a creature you control attacks, put a +1/+1 counter on it.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target creature.", GLEAM_OF_BATTLE.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target creature.");

export const GLEAM_OF_BATTLE_SCRIPT: CardScript = {
  oracleId: GLEAM_OF_BATTLE.oracleId,
  name: GLEAM_OF_BATTLE.name,
  triggers: [
    {
      abilityId: 'creatureYouControlAttacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) => (ev.t === 'AttackersDeclared' ? ev.attackers.filter((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)).map((a) => a.card) : []),
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Gleam of Battle - Put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
