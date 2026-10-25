import { createFileRoute } from "@tanstack/react-router";
import { LiassePage } from "@/pages/liasse";

export const Route = createFileRoute("/liasse")({ component: LiassePage });
