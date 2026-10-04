// `Necrosquito` - a static entersWithCounters, a static pumpPer, a cardPutIntoGraveyard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NECROSQUITO } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(NECROSQUITO, "Flying\nThis creature enters with two oil counters on it.\nThis creature gets +1/+1 for each oil counter on it.\nWhenever another creature or artifact you control is put into a graveyard from the battlefield, put an oil counter on this creature.");
const LINES = PRINTED.split('\n');

// "oil counter on it", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_2(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  return me.counters["oil"] ?? 0;
}


export const NECROSQUITO_SCRIPT: CardScript = {
  oracleId: NECROSQUITO.oracleId,
  name: NECROSQUITO.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-3',
      text: LINES[3] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && m.card !== self && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (ctx.derive(m.card).typeLine.types.includes('Creature') || ctx.derive(m.card).typeLine.types.includes('Artifact')),
        ),
      label: () => "Necrosquito - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 1 }] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 2 }] }],
    },
  ],
  statics: [
    {
      abilityId: 'pump-per-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_2(ctx, self);
        if (chars.power !== null) chars.power += n * 1;
        if (chars.toughness !== null) chars.toughness += n * 1;
      },
    },
  ],
};
