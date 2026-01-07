import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Handle "remember me" - sign out on browser close if not remembered
    const handleBeforeUnload = () => {
      const rememberMe = localStorage.getItem("rememberMe");
      if (rememberMe === "false") {
        supabase.auth.signOut();
        localStorage.removeItem("rememberMe");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), timeoutMs)
      ),
    ]);
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    try {
      const result = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        }),
        15000
      );
      return { error: result.error };
    } catch (e: any) {
      // Handle network errors like "Failed to fetch"
      if (e?.message?.includes("Failed to fetch") || e?.message?.includes("fetch")) {
        return { error: new Error("Unable to connect. Please check your internet connection.") };
      }
      return { error: e as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        15000
      );
      return { error: result.error };
    } catch (e: any) {
      // Handle network errors like "Failed to fetch"
      if (e?.message?.includes("Failed to fetch") || e?.message?.includes("fetch")) {
        return { error: new Error("Unable to connect. Please check your internet connection.") };
      }
      return { error: e as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
