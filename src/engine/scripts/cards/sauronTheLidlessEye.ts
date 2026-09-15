// `Sauron, the Lidless Eye` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAURON_THE_LIDLESS_EYE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAURON_THE_LIDLESS_EYE, "When Sauron enters, gain control of target creature an opponent controls until end of turn. Untap it. It gains haste until end of turn.\n{1}{B}{R}: Creatures you control get +2/+0 until end of turn. Each opponent loses 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Gain control of target creature an opponent controls until end of turn. Untap it. It gains haste until end of turn.", SAURON_THE_LIDLESS_EYE.name);
const VOCAB_T_L0 = vocabularyTargets("Gain control of target creature an opponent controls until end of turn. Untap it. It gains haste until end of turn.");
const VOCAB_A0 = vocabularyEffects("Creatures you control get +2/+0 until end of turn. Each opponent loses 2 life.", SAURON_THE_LIDLESS_EYE.name);
const VOCAB_T_A0 = vocabularyTargets("Creatures you control get +2/+0 until end of turn. Each opponent loses 2 life.");

export const SAURON_THE_LIDLESS_EYE_SCRIPT: CardScript = {
  oracleId: SAURON_THE_LIDLESS_EYE.oracleId,
  name: SAURON_THE_LIDLESS_EYE.name,
  activated: [
    {
      ref: `${SAURON_THE_LIDLESS_EYE.oracleId}#a0`,
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
      label: () => "Sauron, the Lidless Eye - Gain control of target creature an opponent controls until end of turn. Untap it. It gains haste until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
