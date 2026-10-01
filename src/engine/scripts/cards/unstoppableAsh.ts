// `Unstoppable Ash` - a creatureYouControlBecomesBlocked trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNSTOPPABLE_ASH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNSTOPPABLE_ASH, "Trample\nChampion a Treefolk or Warrior (When this enters, sacrifice it unless you exile another Treefolk or Warrior you control. When this leaves the battlefield, that card returns to the battlefield.)\nWhenever a creature you control becomes blocked, it gets +0/+5 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target creature gets +0/+5 until end of turn.", UNSTOPPABLE_ASH.name);
const VOCAB_T_L2 = vocabularyTargets("Target creature gets +0/+5 until end of turn.");

export const UNSTOPPABLE_ASH_SCRIPT: CardScript = {
  oracleId: UNSTOPPABLE_ASH.oracleId,
  name: UNSTOPPABLE_ASH.name,
  triggers: [
    {
      abilityId: 'creatureYouControlBecomesBlocked-2',
      text: LINES[2] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) => (ev.t === 'BlockersDeclared' ? [...new Set(ev.blocks.filter((b) => ctx.state.cards[b.attacker]?.controller === ctx.query.controllerOf(self)).map((b) => b.attacker))] : []),
      matches: (ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => ctx.state.cards[b.attacker]?.controller === ctx.query.controllerOf(self)),
      label: () => "Unstoppable Ash - Target creature gets +0/+5 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
