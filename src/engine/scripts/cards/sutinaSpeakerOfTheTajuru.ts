// `Sutina, Speaker of the Tajuru` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUTINA_SPEAKER_OF_THE_TAJURU } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUTINA_SPEAKER_OF_THE_TAJURU, "When Sutina enters, search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\nWhenever Sutina attacks, you may return a land you control to its owner's hand. When you do, put a +1/+1 counter on target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", SUTINA_SPEAKER_OF_THE_TAJURU.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.");
const VOCAB_L1 = vocabularyEffects("You may return a land you control to its owner's hand. When you do, put a +1/+1 counter on target creature.", SUTINA_SPEAKER_OF_THE_TAJURU.name);
const VOCAB_T_L1 = vocabularyTargets("You may return a land you control to its owner's hand. When you do, put a +1/+1 counter on target creature.");

export const SUTINA_SPEAKER_OF_THE_TAJURU_SCRIPT: CardScript = {
  oracleId: SUTINA_SPEAKER_OF_THE_TAJURU.oracleId,
  name: SUTINA_SPEAKER_OF_THE_TAJURU.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sutina, Speaker of the Tajuru - Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Sutina, Speaker of the Tajuru - You may return a land you control to its owner's hand. When you do, put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
