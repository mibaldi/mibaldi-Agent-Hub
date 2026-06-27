import { createContext, useContext, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';

interface AuthCtx {
  authed: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(!!getToken());

  const login = async (u: string, p: string) => {
    const res = await api.login(u, p);
    setToken(res.token);
    setAuthed(true);
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setToken(null);
    setAuthed(false);
  };

  return <Ctx.Provider value={{ authed, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}
