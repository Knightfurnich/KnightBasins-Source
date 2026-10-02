import { useEffect } from "react";
import { applyRouteMeta } from "@/components/RouteMeta.logic";

export function RouteMeta({ pathname }: { pathname: string }) {
  useEffect(() => applyRouteMeta(pathname), [pathname]);
  return null;
}
