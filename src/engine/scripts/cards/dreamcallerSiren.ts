// `Dreamcaller Siren` - a static blocksOnlyFlying, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREAMCALLER_SIREN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(DREAMCALLER_SIREN, "Flash\nFlying\nThis creature can block only creatures with flying.\nWhen this creature enters, if you control another Pirate, tap up to two target nonland permanents.");
const LINES = PRINTED.split('\n');

const VOCAB_L3 = vocabularyEffects("Tap up to two target nonland permanents.", DREAMCALLER_SIREN.name);
const VOCAB_T_L3 = vocabularyTargets("Tap up to two target nonland permanents.");

// "as long as you control another Pirate" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond3Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    if (inst.id === self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes("Pirate")) continue;
    n++;
  }
  return n >= 1;
}


export const DREAMCALLER_SIREN_SCRIPT: CardScript = {
  oracleId: DREAMCALLER_SIREN.oracleId,
  name: DREAMCALLER_SIREN.name,
  triggers: [
    {
      abilityId: 'etb-3',
      text: LINES[3] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L3,
      matches: (ctx, self, ev) =>
        ifCond3Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Dreamcaller Siren - Tap up to two target nonland permanents.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond3Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
  combat: [
    {
      abilityId: 'blocksOnlyFlying-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => blocker !== self || ctx.derive(attacker).keywords.has('flying'),
    },
  ],
};
