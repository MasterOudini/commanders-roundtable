// `Three Tree Scribe` — the FIRST leaves-WITHOUT-DYING watcher.
//
// ⚠️ THE DESTINATION FILTER IS THE WHOLE CARD. Nefarious Imp's watcher
// (D228) fires on any exit from the battlefield; this one must fire on every
// exit EXCEPT the one that goes to a graveyard. A bounce, an exile, a
// library-top tuck all pay; dying pays NOTHING, and its OWN death paying
// nothing is the case that proves the filter rather than the trigger.
//
// Self-inclusive ("this creature or another creature you control"), so one
// def covers both — the entrant test is the mover's controller, and `self`
// is trivially one of them (Bogwater Lumaret's rule, D165). D259.

import { THREE_TREE_SCRIBE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  THREE_TREE_SCRIBE,
  'Whenever this creature or another creature you control leaves the battlefield without dying, put a +1/+1 counter on target creature you control.',
);

export const THREE_TREE_SCRIBE_SCRIPT: CardScript = {
  oracleId: THREE_TREE_SCRIBE.oracleId,
  name: THREE_TREE_SCRIBE.name,
  triggers: [
    {
      abilityId: 'leaves-not-dying',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield') return false;
          // ⚠️ "without dying" — a graveyard exit is exactly what this excludes.
          if (m.to.kind === 'graveyard') return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== mine) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        });
      },
      label: () => 'Three Tree Scribe — put a +1/+1 counter on target creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] },
        ];
      },
    },
  ],
};
