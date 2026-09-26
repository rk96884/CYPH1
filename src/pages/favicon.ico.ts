import type { APIRoute } from "astro";
import { withBase } from "../utils/base-path";

export const prerender = true;

export const GET: APIRoute = () =>
  Response.redirect(new URL(withBase("brand/generated/cyph1-favicon.svg"), "https://www.cyph1.co.uk"), 308);
