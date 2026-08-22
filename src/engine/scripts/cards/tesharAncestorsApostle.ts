// `Teshar, Ancestor's Apostle` — the historic cast watcher that REANIMATES,
// composing three shipped decisions in one def: D183's historic filter
// (Jhoira's, read off the face actually cast), D171's script reanimation
// (Doomed Necromancer's ordinary CardsMoved so the entry funnel runs on the
// returned permanent), and D139's numeric restriction enforced at the aim.
//
// The flying line is the engine's own keyword; this def claims only the
// trigger. D258.

import { TESHAR_ANCESTOR_S_APOSTLE } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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
  TESHAR_ANCESTOR_S_APOSTLE,
  'Flying\nWhenever you cast a historic spell, return target creature card with mana value 3 or less from your graveyard to the battlefield. (Artifacts, legendaries, and Sagas are historic.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TESHAR_ANCESTORS_APOSTLE_SCRIPT: CardScript = {
  oracleId: TESHAR_ANCESTOR_S_APOSTLE.oracleId,
  name: TESHAR_ANCESTOR_S_APOSTLE.name,
  triggers: [
    {
      abilityId: 'historic-cast',
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
        // CR 700.10 — artifacts, legendaries and Sagas, read off the CAST face.
        const face = oc.faces[inst?.faceIndex ?? 0];
        if (!face) return false;
        const tl = face.typeLine;
        return (
          tl.types.includes('Artifact') ||
          tl.supertypes.includes('Legendary') ||
          tl.subtypes.includes('Saga')
        );
      },
      label: () => "Teshar, Ancestor's Apostle — return a creature card from your graveyard",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        const graveOwner = card.zone.player;
        if (!graveOwner) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'graveyard', player: graveOwner },
                to: { kind: 'battlefield', player: obj.controller },
              },
            ],
          },
        ];
      },
    },
  ],
};
