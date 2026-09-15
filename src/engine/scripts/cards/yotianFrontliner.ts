// `Yotian Frontliner` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YOTIAN_FRONTLINER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YOTIAN_FRONTLINER, "Whenever this creature attacks, another target creature you control gets +1/+1 until end of turn.\nUnearth {W} ({W}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Another target creature you control gets +1/+1 until end of turn.", YOTIAN_FRONTLINER.name);
const VOCAB_T_L0 = vocabularyTargets("Another target creature you control gets +1/+1 until end of turn.");

export const YOTIAN_FRONTLINER_SCRIPT: CardScript = {
  oracleId: YOTIAN_FRONTLINER.oracleId,
  name: YOTIAN_FRONTLINER.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Yotian Frontliner - Another target creature you control gets +1/+1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
