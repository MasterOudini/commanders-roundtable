// `Prescient Chimera` — "Whenever you cast an instant or sorcery spell,
// scry 1." The cast-watcher raising D195's ask; the Flying line is the
// engine's. D234.

import { PRESCIENT_CHIMERA } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(
  PRESCIENT_CHIMERA,
  'Flying\nWhenever you cast an instant or sorcery spell, scry 1. ' +
    '(Look at the top card of your library. You may put that card on the bottom.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const PRESCIENT_CHIMERA_SCRIPT: CardScript = {
  oracleId: PRESCIENT_CHIMERA.oracleId,
  name: PRESCIENT_CHIMERA.name,
  triggers: [
    {
      abilityId: 'cast-scry',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        const types = faceOf(oc, ev.obj.faceIndex).typeLine.types;
        return types.includes('Instant') || types.includes('Sorcery');
      },
      label: () => 'Prescient Chimera — scry 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: false,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
