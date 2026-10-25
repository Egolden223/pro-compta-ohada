import { createFileRoute } from "@tanstack/react-router";
import { StockPage } from "@/pages/articles-stock";

export const Route = createFileRoute("/stock")({ component: StockPage });
