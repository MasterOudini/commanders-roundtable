// `Solemn Simulacrum` - a etb trigger vocab, a dies trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOLEMN_SIMULACRUM } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SOLEMN_SIMULACRUM, "When this creature enters, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\nWhen this creature dies, you may draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.", SOLEMN_SIMULACRUM.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.");

export const SOLEMN_SIMULACRUM_SCRIPT: CardScript = {
  oracleId: SOLEMN_SIMULACRUM.oracleId,
  name: SOLEMN_SIMULACRUM.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Solemn Simulacrum - Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Solemn Simulacrum - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
