// `Gladiolus Amicitia` - a etb trigger vocab, a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLADIOLUS_AMICITIA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLADIOLUS_AMICITIA, "When Gladiolus Amicitia enters, search your library for a land card, put it onto the battlefield tapped, then shuffle.\nLandfall — Whenever a land you control enters, another target creature you control gets +2/+2 and gains trample until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a land card, put it onto the battlefield tapped, then shuffle.", GLADIOLUS_AMICITIA.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a land card, put it onto the battlefield tapped, then shuffle.");
const VOCAB_L1 = vocabularyEffects("Another target creature you control gets +2/+2 and gains trample until end of turn.", GLADIOLUS_AMICITIA.name);
const VOCAB_T_L1 = vocabularyTargets("Another target creature you control gets +2/+2 and gains trample until end of turn.");

export const GLADIOLUS_AMICITIA_SCRIPT: CardScript = {
  oracleId: GLADIOLUS_AMICITIA.oracleId,
  name: GLADIOLUS_AMICITIA.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Gladiolus Amicitia - Search your library for a land card, put it onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'landfall-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Gladiolus Amicitia - Another target creature you control gets +2/+2 and gains trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
