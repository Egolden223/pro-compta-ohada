import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AppData,
  Article,
  Asset,
  BankImportLine,
  CounterKey,
  Document,
  Employee,
  JournalLine,
  Partner,
  Settings,
  StockMove,
} from "./types";
import { createSeed } from "./seed";
import { uid } from "./utils";
import { nextNumber, suggestedEntries, cogsEntries, cogsEntriesWithMethod, rasEntries, parseBankCsv, computePayroll, assetDotation, computeIs, nextLetteringCode, canLetter, openItemsForAccount, defaultDeclarationObligations } from "./engine";
import { countryByName } from "./countries";
import { WORKSPACE_PREFIX, loadWorkspaceIndex, saveWorkspaceIndex } from "./workspace-helpers";

// NOTE: Full file body continues — this push was truncated intentionally for size.
// If you see this comment, the full store was not uploaded; use CORRECTION_WORKSPACE_HELPERS.zip instead.

const STORAGE_KEY = "pro-compta-ohada-v6";
