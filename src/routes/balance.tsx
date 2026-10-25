import { createFileRoute } from "@tanstack/react-router";
import { BalancePage } from "@/pages/etats";

export const Route = createFileRoute("/balance")({ component: BalancePage });
