import { createFileRoute } from "@tanstack/react-router";
import { AnalytiquePage } from "@/pages/analytique";

export const Route = createFileRoute("/analytique")({ component: AnalytiquePage });
