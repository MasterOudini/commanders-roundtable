// `Bristly Bill, Spine Sower` - a landfall trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRISTLY_BILL_SPINE_SOWER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRISTLY_BILL_SPINE_SOWER, "Landfall — Whenever a land you control enters, put a +1/+1 counter on target creature.\n{3}{G}{G}: Double the number of +1/+1 counters on each creature you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target creature.", BRISTLY_BILL_SPINE_SOWER.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target creature.");
const VOCAB_A0 = vocabularyEffects("Double the number of +1/+1 counters on each creature you control.", BRISTLY_BILL_SPINE_SOWER.name);
const VOCAB_T_A0 = vocabularyTargets("Double the number of +1/+1 counters on each creature you control.");

export const BRISTLY_BILL_SPINE_SOWER_SCRIPT: CardScript = {
  oracleId: BRISTLY_BILL_SPINE_SOWER.oracleId,
  name: BRISTLY_BILL_SPINE_SOWER.name,
  activated: [
    {
      ref: `${BRISTLY_BILL_SPINE_SOWER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'landfall-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Bristly Bill, Spine Sower - Put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
