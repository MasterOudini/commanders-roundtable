// `Thran Vigil` — the graveyard-EXIT watcher (Stonebound Mentor's shape,
// D253) gated on "during your turn": the condition is the ACTIVE PLAYER at
// the moment the cards leave, which the engine answers with no input from
// anybody. The mover's type is read off the ORACLE face, because a card in a
// graveyard has no battlefield derivation (D171). D259.

import { THRAN_VIGIL } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  THRAN_VIGIL,
  'Whenever one or more artifact and/or creature cards leave your graveyard during your turn, put a +1/+1 counter on target creature you control.',
);

export const THRAN_VIGIL_SCRIPT: CardScript = {
  oracleId: THRAN_VIGIL.oracleId,
  name: THRAN_VIGIL.name,
  triggers: [
    {
      abilityId: 'graveyard-exit',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        // "during your turn" — the whole condition, and the engine owns it.
        if (ctx.state.turn.activePlayer !== mine) return false;
        return ev.moves.some((m) => {
          if (m.from.kind !== 'graveyard' || m.from.player !== mine) return false;
          const inst = ctx.state.cards[m.card];
          if (!inst) return false;
          const oc = ctx.oracle.byPrinting(inst.printingId);
          if (!oc) return false;
          const types = faceOf(oc, inst.faceIndex ?? 0).typeLine.types;
          return types.includes('Artifact') || types.includes('Creature');
        });
      },
      label: () => 'Thran Vigil — put a +1/+1 counter on target creature you control',
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
