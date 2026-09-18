// `Brackwater Elemental` - a attacks trigger vocab, a blocks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRACKWATER_ELEMENTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRACKWATER_ELEMENTAL, "When this creature attacks or blocks, sacrifice it at the beginning of the next end step.\nUnearth {2}{U} ({2}{U}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Sacrifice it at the beginning of the next end step.", BRACKWATER_ELEMENTAL.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice it at the beginning of the next end step.");

export const BRACKWATER_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: BRACKWATER_ELEMENTAL.oracleId,
  name: BRACKWATER_ELEMENTAL.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Brackwater Elemental - Sacrifice it at the beginning of the next end step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'blocks-0',
      text: LINES[0] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Brackwater Elemental - Sacrifice it at the beginning of the next end step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
