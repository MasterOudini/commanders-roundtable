// `Brutal Cathar // Moonrage Brute` - a etb trigger vocab, a transformsInto trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRUTAL_CATHAR_MOONRAGE_BRUTE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(BRUTAL_CATHAR_MOONRAGE_BRUTE, "Whenever this creature enters or transforms into Brutal Cathar, exile target creature an opponent controls until this creature leaves the battlefield.\nDaybound (If a player casts no spells during their own turn, it becomes night next turn.)\nFirst strike\nWard—Pay 3 life.\nNightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile target creature an opponent controls until this creature leaves the battlefield.", BRUTAL_CATHAR_MOONRAGE_BRUTE.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target creature an opponent controls until this creature leaves the battlefield.");

export const BRUTAL_CATHAR_MOONRAGE_BRUTE_SCRIPT: CardScript = {
  oracleId: BRUTAL_CATHAR_MOONRAGE_BRUTE.oracleId,
  name: BRUTAL_CATHAR_MOONRAGE_BRUTE.name,
  triggers: [
    {
      abilityId: 'etb-0', face: 0,
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Brutal Cathar // Moonrage Brute - Exile target creature an opponent controls until this creature leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'transformsInto-0', face: 0,
      text: LINES[0] as string,
      event: 'FaceIndexSet',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'FaceIndexSet' && ev.card === self,
      label: () => "Brutal Cathar // Moonrage Brute - Exile target creature an opponent controls until this creature leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
