import { createFileRoute } from "@tanstack/react-router";
import { MobileMoneyPage } from "@/pages/mobile-money";

export const Route = createFileRoute("/mobile-money")({ component: MobileMoneyPage });
