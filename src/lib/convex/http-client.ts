import { ConvexHttpClient } from "convex/browser";
import { ENV } from "../config/env";

export function getConvexHttpClient(): ConvexHttpClient {
  return new ConvexHttpClient(ENV.NEXT_PUBLIC_CONVEX_URL);
}
