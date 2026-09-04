// `Reaper King` - the layer-6 anthem "Other Scarecrow creatures you control get
// +1/+1" (a StaticDef in the shape of the engine's Levitation, D300) and
// "Whenever another Scarecrow you control enters, destroy target permanent" - a
// per-item enters trigger (D185's fan-out), one firing and one target per
// Scarecrow that entered. The hybrid-cost reminder line is print.

import { REAPER_KING } from '../../../data/fixtures/engineCards';
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
  REAPER_KING,
  "({2/W} can be paid with any two mana or with {W}. This card's mana value is 10.)\nOther Scarecrow creatures you control get +1/+1.\nWhenever another Scarecrow you control enters, destroy target permanent.",
);
const LINES = PRINTED.split('\n');
const ENTERS = LINES[2] as string;

export const REAPER_KING_SCRIPT: CardScript = {
  oracleId: REAPER_KING.oracleId,
  name: REAPER_KING.name,
  statics: [
    {
      abilityId: 'anthem',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        if (candidate === self) return false;
        if (!chars.typeLine.types.includes('Creature')) return false;
        return chars.typeLine.subtypes.includes('Scarecrow');
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
  triggers: [
    {
      abilityId: 'another-scarecrow-enters',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTERS),
      matches: (_ctx, _self, ev) => ev.t === 'CardsMoved',
      perItem: (ctx, self, ev) =>
        ev.t !== 'CardsMoved'
          ? []
          : ev.moves
              .filter(
                (m) =>
                  m.card !== self &&
                  m.to.kind === 'battlefield' &&
                  m.from.kind !== 'battlefield' &&
                  ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) &&
                  ctx.derive(m.card).typeLine.subtypes.includes('Scarecrow'),
              )
              .map((m) => m.card),
      label: () => 'Reaper King - destroy target permanent',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        // CR 701.7b - an indestructible permanent is not destroyed.
        if (ctx.derive(target.id).keywords.has('indestructible')) return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'graveyard', player: card.owner } }] }];
      },
    },
  ],
};
