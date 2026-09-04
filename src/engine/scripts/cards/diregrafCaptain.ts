// `Diregraf Captain` - the layer-6 anthem "Other Zombie creatures you control get
// +1/+1" (a StaticDef in the shape of the engine's Levitation, D300) and
// "Whenever another Zombie you control dies, target opponent loses 1 life" - a
// per-item dies trigger (D185's fan-out) aimed at an opponent. Deathtouch is the
// engine's.

import { DIREGRAF_CAPTAIN } from '../../../data/fixtures/engineCards';
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
  DIREGRAF_CAPTAIN,
  'Deathtouch\nOther Zombie creatures you control get +1/+1.\nWhenever another Zombie you control dies, target opponent loses 1 life.',
);
const LINES = PRINTED.split('\n');
const DIES = LINES[2] as string;

export const DIREGRAF_CAPTAIN_SCRIPT: CardScript = {
  oracleId: DIREGRAF_CAPTAIN.oracleId,
  name: DIREGRAF_CAPTAIN.name,
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
        return chars.typeLine.subtypes.includes('Zombie');
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
  triggers: [
    {
      abilityId: 'another-zombie-dies',
      text: DIES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(DIES),
      matches: (_ctx, _self, ev) => ev.t === 'CardsMoved',
      // One firing per Zombie that died, its own target each (D185).
      perItem: (ctx, self, ev) =>
        ev.t !== 'CardsMoved'
          ? []
          : ev.moves
              .filter(
                (m) =>
                  m.card !== self &&
                  m.from.kind === 'battlefield' &&
                  m.to.kind === 'graveyard' &&
                  ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) &&
                  ctx.derive(m.card).typeLine.subtypes.includes('Zombie'),
              )
              .map((m) => m.card),
      label: () => 'Diregraf Captain - target opponent loses 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const them = ctx.state.players[target.id];
        if (!them || them.hasLost) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -1, to: them.life - 1 }];
      },
    },
  ],
};
