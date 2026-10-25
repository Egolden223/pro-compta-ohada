import { createFileRoute } from "@tanstack/react-router";
import { TvaPage } from "@/pages/banque-fiscal";

export const Route = createFileRoute("/tva")({ component: TvaPage });
