import { createFileRoute } from "@tanstack/react-router";
import { FiscalitePage } from "@/pages/banque-fiscal";

export const Route = createFileRoute("/fiscalite")({ component: FiscalitePage });
