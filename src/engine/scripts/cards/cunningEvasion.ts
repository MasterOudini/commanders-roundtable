// `Cunning Evasion` - a creatureYouControlBecomesBlocked trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CUNNING_EVASION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CUNNING_EVASION, "Whenever a creature you control becomes blocked, you may return it to its owner's hand.");

const VOCAB_L0 = vocabularyEffects("Return target creature to its owner's hand.", CUNNING_EVASION.name);
const VOCAB_T_L0 = vocabularyTargets("Return target creature to its owner's hand.");

export const CUNNING_EVASION_SCRIPT: CardScript = {
  oracleId: CUNNING_EVASION.oracleId,
  name: CUNNING_EVASION.name,
  triggers: [
    {
      abilityId: 'creatureYouControlBecomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: true,
      perItem: (ctx, self, ev) => (ev.t === 'BlockersDeclared' ? [...new Set(ev.blocks.filter((b) => ctx.state.cards[b.attacker]?.controller === ctx.query.controllerOf(self)).map((b) => b.attacker))] : []),
      matches: (ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => ctx.state.cards[b.attacker]?.controller === ctx.query.controllerOf(self)),
      label: () => "Cunning Evasion - Return target creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
