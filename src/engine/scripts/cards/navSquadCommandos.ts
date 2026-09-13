// `Nav Squad Commandos` - a battalion trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NAV_SQUAD_COMMANDOS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NAV_SQUAD_COMMANDOS, "Battalion — Whenever this creature and at least two other creatures attack, this creature gets +1/+1 until end of turn. Untap it.");

const VOCAB_L0 = vocabularyEffects("This creature gets +1/+1 until end of turn. Untap it.", NAV_SQUAD_COMMANDOS.name);
const VOCAB_T_L0 = vocabularyTargets("This creature gets +1/+1 until end of turn. Untap it.");

export const NAV_SQUAD_COMMANDOS_SCRIPT: CardScript = {
  oracleId: NAV_SQUAD_COMMANDOS.oracleId,
  name: NAV_SQUAD_COMMANDOS.name,
  triggers: [
    {
      abilityId: 'battalion-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ev.attackers.length >= 3,
      label: () => "Nav Squad Commandos - This creature gets +1/+1 until end of turn. Untap it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
