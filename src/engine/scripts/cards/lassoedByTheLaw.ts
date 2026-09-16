// `Lassoed by the Law` - a etb trigger vocab, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LASSOED_BY_THE_LAW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LASSOED_BY_THE_LAW, "When this enchantment enters, exile target nonland permanent an opponent controls until this enchantment leaves the battlefield.\nWhen this enchantment enters, create a 1/1 red Mercenary creature token with \"{T}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile target nonland permanent an opponent controls until this enchantment leaves the battlefield.", LASSOED_BY_THE_LAW.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target nonland permanent an opponent controls until this enchantment leaves the battlefield.");
const VOCAB_L1 = vocabularyEffects("Create a 1/1 red Mercenary creature token with \"{T}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery.\"", LASSOED_BY_THE_LAW.name);
const VOCAB_T_L1 = vocabularyTargets("Create a 1/1 red Mercenary creature token with \"{T}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery.\"");

export const LASSOED_BY_THE_LAW_SCRIPT: CardScript = {
  oracleId: LASSOED_BY_THE_LAW.oracleId,
  name: LASSOED_BY_THE_LAW.name,
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
      label: () => "Lassoed by the Law - Exile target nonland permanent an opponent controls until this enchantment leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Lassoed by the Law - Create a 1/1 red Mercenary creature token with \"{T}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
