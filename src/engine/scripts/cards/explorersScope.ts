// `Explorer's Scope` - a equippedCreatureAttacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXPLORER_S_SCOPE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXPLORER_S_SCOPE, "Whenever equipped creature attacks, look at the top card of your library. If it's a land card, you may put it onto the battlefield tapped.\nEquip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Look at the top card of your library. If it's a land card, you may put it onto the battlefield tapped.", EXPLORER_S_SCOPE.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top card of your library. If it's a land card, you may put it onto the battlefield tapped.");

export const EXPLORERS_SCOPE_SCRIPT: CardScript = {
  oracleId: EXPLORER_S_SCOPE.oracleId,
  name: EXPLORER_S_SCOPE.name,
  triggers: [
    {
      abilityId: 'equippedCreatureAttacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === ctx.state.cards[self]?.attachedTo),
      label: () => "Explorer's Scope - Look at the top card of your library. If it's a land card, you may put it onto the battlefield tapped.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
