// `Foggy Nelson, On Retainer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FOGGY_NELSON_ON_RETAINER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FOGGY_NELSON_ON_RETAINER, "Flash\nWhen Foggy Nelson enters, put a +1/+1 counter on another target creature you control. It gains hexproof until end of turn. (It can't be the target of spells or abilities your opponents control.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on another target creature you control. It gains hexproof until end of turn.", FOGGY_NELSON_ON_RETAINER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on another target creature you control. It gains hexproof until end of turn.");

export const FOGGY_NELSON_ON_RETAINER_SCRIPT: CardScript = {
  oracleId: FOGGY_NELSON_ON_RETAINER.oracleId,
  name: FOGGY_NELSON_ON_RETAINER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Foggy Nelson, On Retainer - Put a +1/+1 counter on another target creature you control. It gains hexproof until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
