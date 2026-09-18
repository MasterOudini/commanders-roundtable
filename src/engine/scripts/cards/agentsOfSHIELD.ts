// `Agents of S.H.I.E.L.D.` - a aCreatureAttacksAlone trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AGENTS_OF_S_H_I_E_L_D } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AGENTS_OF_S_H_I_E_L_D, "Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.");

const VOCAB_L0 = vocabularyEffects("Target creature gets +1/+1 until end of turn.", AGENTS_OF_S_H_I_E_L_D.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature gets +1/+1 until end of turn.");

export const AGENTS_OF_SHIELD_SCRIPT: CardScript = {
  oracleId: AGENTS_OF_S_H_I_E_L_D.oracleId,
  name: AGENTS_OF_S_H_I_E_L_D.name,
  triggers: [
    {
      abilityId: 'aCreatureAttacksAlone-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, _self, ev) => (ev.t === 'AttackersDeclared' && ev.attackers.length === 1 ? ev.attackers.map((a) => a.card) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.length === 1 && ev.attackers.every((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Agents of S.H.I.E.L.D. - Target creature gets +1/+1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
