// `Exuberant Fuseling` - a static pumpPer, a etb trigger selfCounter, a cardPutIntoGraveyard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXUBERANT_FUSELING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXUBERANT_FUSELING, "Trample\nThis creature gets +1/+0 for each oil counter on it.\nWhen this creature enters and whenever another creature or artifact you control is put into a graveyard from the battlefield, put an oil counter on this creature.");
const LINES = PRINTED.split('\n');

// "oil counter on it", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  return me.counters["oil"] ?? 0;
}


export const EXUBERANT_FUSELING_SCRIPT: CardScript = {
  oracleId: EXUBERANT_FUSELING.oracleId,
  name: EXUBERANT_FUSELING.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Exuberant Fuseling - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 1 }] }];
      },
    },
    {
      abilityId: 'cardPutIntoGraveyard-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && m.card !== self && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (ctx.derive(m.card).typeLine.types.includes('Creature') || ctx.derive(m.card).typeLine.types.includes('Artifact')),
        ),
      label: () => "Exuberant Fuseling - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 1 }] }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'pump-per-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_1(ctx, self);
        if (chars.power !== null) chars.power += n * 1;
        if (chars.toughness !== null) chars.toughness += n * 0;
      },
    },
  ],
};
