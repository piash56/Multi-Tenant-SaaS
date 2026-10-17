"use client";

import { ApiError } from "@saas/api-client";
import type { AuthMembership, AuthUser } from "@saas/shared-types";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";

type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "error"; message: string }
  | { status: "authenticated"; user: AuthUser; membership?: AuthMembership };

interface AuthContextValue {
  state: AuthState;
  refreshUser(): Promise<void>;
  selectOrganization(organizationId: string): void;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function selectedMembership(user: AuthUser): AuthMembership | undefined {
  const selected =
    typeof window === "undefined" ? null : sessionStorage.getItem("activeOrganizationId");
  return (
    user.memberships.find(({ organizationId }) => organizationId === selected) ??
    user.memberships[0]
  );
}

async function getAuthState(): Promise<AuthState> {
  try {
    const { user } = await api.getCurrentUser();
    const membership = selectedMembership(user);
    if (membership) sessionStorage.setItem("activeOrganizationId", membership.organizationId);
    return membership
      ? { status: "authenticated", user, membership }
      : { status: "authenticated", user };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { status: "guest" };
    return {
      status: "error",
      message: "We could not verify your session. Check your connection and try again.",
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refreshUser = useCallback(async () => {
    setState({ status: "loading" });
    setState(await getAuthState());
  }, []);

  useEffect(() => {
    let active = true;
    void getAuthState().then((nextState) => {
      if (active) setState(nextState);
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      refreshUser,
      selectOrganization(organizationId) {
        if (state.status !== "authenticated") return;
        const membership = state.user.memberships.find(
          (item) => item.organizationId === organizationId,
        );
        if (!membership) return;
        sessionStorage.setItem("activeOrganizationId", organizationId);
        setState({ ...state, membership });
      },
      async logout() {
        await api.logout();
        sessionStorage.removeItem("activeOrganizationId");
        setState({ status: "guest" });
        router.replace("/login");
        router.refresh();
      },
    }),
    [refreshUser, router, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
