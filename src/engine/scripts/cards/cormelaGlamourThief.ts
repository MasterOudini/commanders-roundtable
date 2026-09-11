// `Cormela, Glamour Thief` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORMELA_GLAMOUR_THIEF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORMELA_GLAMOUR_THIEF, "Haste\n{1}, {T}: Add {U}{B}{R}. Spend this mana only to cast instant and/or sorcery spells.\nWhen Cormela dies, return up to one target instant or sorcery card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Return up to one target instant or sorcery card from your graveyard to your hand.", CORMELA_GLAMOUR_THIEF.name);
const VOCAB_T_L2 = vocabularyTargets("Return up to one target instant or sorcery card from your graveyard to your hand.");

export const CORMELA_GLAMOUR_THIEF_SCRIPT: CardScript = {
  oracleId: CORMELA_GLAMOUR_THIEF.oracleId,
  name: CORMELA_GLAMOUR_THIEF.name,
  triggers: [
    {
      abilityId: 'dies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Cormela, Glamour Thief - Return up to one target instant or sorcery card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
