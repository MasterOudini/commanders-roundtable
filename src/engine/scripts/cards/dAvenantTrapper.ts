// `D'Avenant Trapper` — "Whenever you cast a historic spell, tap target
// creature an opponent controls." The first HISTORIC filter (D170): artifact,
// legendary, or Saga, asked of the FACE ACTUALLY CAST (D155's rule) through
// the oracle — plus the staged target and Auriok's tapped-guard. M6.4m, D170.

import { D_AVENANT_TRAPPER } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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

const TEXT = printed(
  D_AVENANT_TRAPPER,
  'Whenever you cast a historic spell, tap target creature an opponent controls. (Artifacts, legendaries, and Sagas are historic.)',
);

export const D_AVENANT_TRAPPER_SCRIPT: CardScript = {
  oracleId: D_AVENANT_TRAPPER.oracleId,
  name: D_AVENANT_TRAPPER.name,
  triggers: [
    {
      abilityId: 'cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
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
      label: () => "D'Avenant Trapper — tap target creature an opponent controls",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
