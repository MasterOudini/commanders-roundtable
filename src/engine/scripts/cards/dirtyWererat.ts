// `Dirty Wererat` - an activation regenerate, a static threshold, a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIRTY_WERERAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIRTY_WERERAT, "{B}, Discard a card: Regenerate this creature.\nThreshold — As long as there are seven or more cards in your graveyard, this creature gets +2/+2 and can't block.");
const LINES = PRINTED.split('\n');

// Threshold - seven or more cards in its controller's graveyard, read off the zones (a count is not a characteristic, CR 604.3).
function thresholdOf(ctx: ScriptCtx, self: InstanceId): boolean {
  const who = ctx.query.controllerOf(self);
  return who !== null && (ctx.state.zones.graveyard[who] ?? []).length >= 7;
}

export const DIRTY_WERERAT_SCRIPT: CardScript = {
  oracleId: DIRTY_WERERAT.oracleId,
  name: DIRTY_WERERAT.name,
  activated: [
    {
      ref: `${DIRTY_WERERAT.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBlock-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker) => !thresholdOf(ctx, self) || (blocker !== self),
    },
  ],
  statics: [
    {
      abilityId: 'threshold-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && thresholdOf(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};
