"use client";

import { AuthProvider } from "./context";
import type { ReactNode } from "react";

export function ClientAuthWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}