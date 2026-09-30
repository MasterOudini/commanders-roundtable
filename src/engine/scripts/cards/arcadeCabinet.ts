// `Arcade Cabinet` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARCADE_CABINET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARCADE_CABINET, "When this artifact enters, put a +1/+1 counter on each of up to four target creatures.\n{2}, {T}, Sacrifice a token: Double the number of each kind of counter on target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on each of up to four target creatures.", ARCADE_CABINET.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on each of up to four target creatures.");
const VOCAB_A0 = vocabularyEffects("Double the number of each kind of counter on target creature.", ARCADE_CABINET.name);
const VOCAB_T_A0 = vocabularyTargets("Double the number of each kind of counter on target creature.");

export const ARCADE_CABINET_SCRIPT: CardScript = {
  oracleId: ARCADE_CABINET.oracleId,
  name: ARCADE_CABINET.name,
  activated: [
    {
      ref: `${ARCADE_CABINET.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Arcade Cabinet - Put a +1/+1 counter on each of up to four target creatures.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
