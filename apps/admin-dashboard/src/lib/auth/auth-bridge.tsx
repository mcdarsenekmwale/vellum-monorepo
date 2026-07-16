"use client";

import { useAuth, _setRouterAuth } from "./context";
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

export function AuthBridge() {
  const auth = useAuth();
  const router = useRouter();
  _setRouterAuth(auth);
  useEffect(() => {
    router.invalidate();
  }, [auth.isAuthenticated, auth.user?.role, router]);
  return null;
}