import { Link } from "react-router";
import type { Route } from "./+types/home";
import { Source } from "../source/source";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Lessons in Perspective" },
    { name: "Visual Poetry Collection"},
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_NETLIFY };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <Source />;
}

