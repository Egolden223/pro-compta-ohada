import { createFileRoute } from "@tanstack/react-router";
import { EcheancesPage } from "@/pages/echeances";

export const Route = createFileRoute("/echeances")({ component: EcheancesPage });
