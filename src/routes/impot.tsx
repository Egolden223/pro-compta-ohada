import { createFileRoute } from "@tanstack/react-router";
import { ImpotPage } from "@/pages/banque-fiscal";

export const Route = createFileRoute("/impot")({ component: ImpotPage });
