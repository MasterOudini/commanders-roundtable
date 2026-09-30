// `Skyclave Pick-Axe` - a etb trigger vocab, a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYCLAVE_PICK_AXE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(SKYCLAVE_PICK_AXE, "When this Equipment enters, attach it to target creature you control.\nLandfall — Whenever a land you control enters, equipped creature gets +2/+2 until end of turn.\nEquip {2}{G} ({2}{G}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Attach ~ to target creature you control.", SKYCLAVE_PICK_AXE.name);
const VOCAB_T_L0 = vocabularyTargets("Attach ~ to target creature you control.");
const VOCAB_L1 = vocabularyEffects("Equipped creature gets +2/+2 until end of turn.", SKYCLAVE_PICK_AXE.name);
const VOCAB_T_L1 = vocabularyTargets("Equipped creature gets +2/+2 until end of turn.");

export const SKYCLAVE_PICK_AXE_SCRIPT: CardScript = {
  oracleId: SKYCLAVE_PICK_AXE.oracleId,
  name: SKYCLAVE_PICK_AXE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Skyclave Pick-Axe - Attach ~ to target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'landfall-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Skyclave Pick-Axe - Equipped creature gets +2/+2 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
