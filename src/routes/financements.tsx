import { createFileRoute } from "@tanstack/react-router";
import { FinancementsPage } from "@/pages/financements";

export const Route = createFileRoute("/financements")({ component: FinancementsPage });
