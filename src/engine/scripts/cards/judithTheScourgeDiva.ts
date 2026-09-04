// `Judith, the Scourge Diva` - the layer-6 anthem "Other creatures you control get
// +1/+0" (a StaticDef in the shape of the engine's Levitation, D300) and
// "Whenever a nontoken creature you control dies, Judith deals 1 damage to any
// target" - a per-item dies trigger (D185's fan-out), one firing and one target
// per nontoken creature that died.

import { JUDITH_THE_SCOURGE_DIVA } from '../../../data/fixtures/engineCards';
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
  JUDITH_THE_SCOURGE_DIVA,
  'Other creatures you control get +1/+0.\nWhenever a nontoken creature you control dies, Judith deals 1 damage to any target.',
);
const LINES = PRINTED.split('\n');
const DIES = LINES[1] as string;

export const JUDITH_THE_SCOURGE_DIVA_SCRIPT: CardScript = {
  oracleId: JUDITH_THE_SCOURGE_DIVA.oracleId,
  name: JUDITH_THE_SCOURGE_DIVA.name,
  statics: [
    {
      abilityId: 'anthem',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        if (candidate === self) return false;
        return chars.typeLine.types.includes('Creature');
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
      },
    },
  ],
  triggers: [
    {
      abilityId: 'nontoken-creature-dies',
      text: DIES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(DIES),
      matches: (_ctx, _self, ev) => ev.t === 'CardsMoved',
      perItem: (ctx, self, ev) =>
        ev.t !== 'CardsMoved'
          ? []
          : ev.moves
              .filter((m) => {
                const inst = ctx.state.cards[m.card];
                return (
                  m.from.kind === 'battlefield' &&
                  m.to.kind === 'graveyard' &&
                  inst !== undefined &&
                  !inst.isToken &&
                  inst.controller === ctx.query.controllerOf(self) &&
                  ctx.derive(m.card).typeLine.types.includes('Creature')
                );
              })
              .map((m) => m.card),
      label: () => 'Judith, the Scourge Diva - 1 damage to any target',
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card') {
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') return [];
        } else if (!ctx.state.players[target.id] || ctx.state.players[target.id]?.hasLost) {
          return [];
        }
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'card' ? { kind: 'card', id: target.id } : { kind: 'player', id: target.id },
                amount: 1,
                deathtouch: false,
                lifelinkTo: null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
