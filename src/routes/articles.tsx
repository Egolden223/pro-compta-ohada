import { createFileRoute } from "@tanstack/react-router";
import { ArticlesPage } from "@/pages/articles-stock";

export const Route = createFileRoute("/articles")({ component: ArticlesPage });
