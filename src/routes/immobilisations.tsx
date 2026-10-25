import { createFileRoute } from "@tanstack/react-router";
import { PaiePage } from "@/pages/paie-immo";

export const Route = createFileRoute("/immobilisations")({ component: PaiePage });
