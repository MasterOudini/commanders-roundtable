// `Somberwald Alpha` - a creatureYouControlBecomesBlocked trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOMBERWALD_ALPHA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOMBERWALD_ALPHA, "Whenever a creature you control becomes blocked, it gets +1/+1 until end of turn.\n{1}{G}: Target creature you control gains trample until end of turn. (It can deal excess combat damage to the player or planeswalker it's attacking.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target creature gets +1/+1 until end of turn.", SOMBERWALD_ALPHA.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature gets +1/+1 until end of turn.");
const VOCAB_A0 = vocabularyEffects("Target creature you control gains trample until end of turn.", SOMBERWALD_ALPHA.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gains trample until end of turn.");

export const SOMBERWALD_ALPHA_SCRIPT: CardScript = {
  oracleId: SOMBERWALD_ALPHA.oracleId,
  name: SOMBERWALD_ALPHA.name,
  activated: [
    {
      ref: `${SOMBERWALD_ALPHA.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'creatureYouControlBecomesBlocked-0',
      text: LINES[0] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) => (ev.t === 'BlockersDeclared' ? [...new Set(ev.blocks.filter((b) => ctx.state.cards[b.attacker]?.controller === ctx.query.controllerOf(self)).map((b) => b.attacker))] : []),
      matches: (ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => ctx.state.cards[b.attacker]?.controller === ctx.query.controllerOf(self)),
      label: () => "Somberwald Alpha - Target creature gets +1/+1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
