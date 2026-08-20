// `Artificer's Assistant` — "Whenever you cast a historic spell, scry 1."
// D183's historic filter (artifact, legendary, Saga — off the face actually
// cast) raising the D195 ask. D198.

import { ARTIFICER_S_ASSISTANT } from '../../../data/fixtures/engineCards';
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
  ARTIFICER_S_ASSISTANT,
  'Flying\nWhenever you cast a historic spell, scry 1. (Artifacts, legendaries, and Sagas are historic. To scry 1, look at the top card of your library, then you may put that card on the bottom.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const ARTIFICERS_ASSISTANT_SCRIPT: CardScript = {
  oracleId: ARTIFICER_S_ASSISTANT.oracleId,
  name: ARTIFICER_S_ASSISTANT.name,
  triggers: [
    {
      abilityId: 'historic-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        // Jhoira's exact filter (D183) — historic, off the FACE actually cast.
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        const face = faceOf(oc, ev.obj.faceIndex);
        return (
          face.typeLine.types.includes('Artifact') ||
          face.typeLine.supertypes.includes('Legendary') ||
          face.typeLine.subtypes.includes('Saga')
        );
      },
      label: () => "Artificer's Assistant — scry 1",
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
