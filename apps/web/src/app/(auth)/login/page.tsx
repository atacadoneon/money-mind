"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { env } from "@/lib/env";

const isDevLocal = !env.SUPABASE_URL;

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres")
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const setOrgId = useAuthStore((s) => s.setOrgId);
  const [loading, setLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const setCompanies = useAuthStore((s) => s.setCompanies);
  const setSelectedCompany = useAuthStore((s) => s.setSelectedCompany);

  async function devLogin() {
    setLoading(true);
    try {
      const res = await fetch(`${env.API_URL}/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@moneymind.app" }),
      });
      if (!res.ok) throw new Error("Dev login failed");
      const loginData = await res.json();
      const token = loginData.data?.access_token ?? loginData.access_token;
      const orgId = loginData.data?.org_id ?? loginData.org_id;
      const user = loginData.data?.user ?? loginData.user;

      localStorage.setItem("mm:dev-token", token);
      if (orgId) localStorage.setItem("mm:orgId", orgId);
      setUser(user);
      if (orgId) setOrgId(orgId);

      // Fetch companies from API
      try {
        const compRes = await fetch(`${env.API_URL}/companies`, {
          headers: { Authorization: `Bearer ${token}`, "x-org-id": orgId ?? "" },
        });
        if (compRes.ok) {
          const compData = await compRes.json();
          const companies = (compData.data ?? []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            nome: (c.tradeName ?? c.name) as string,
            cnpj: (c.cnpj ?? "") as string,
            avatarColor: (c.color ?? "#3b82f6") as string,
          }));
          if (companies.length > 0) {
            setCompanies(companies);
            setSelectedCompany(companies[0]);
          }
        }
      } catch { /* companies fetch optional */ }

      toast.success("Dev login - Bem-vindo!");
      router.push("/inicio");
    } catch (err) {
      toast.error((err as Error).message ?? "Falha no dev login");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: FormData) {
    if (isDevLocal) {
      await devLogin();
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowser();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });
      if (error) throw error;
      if (authData.user) {
        setUser({
          id: authData.user.id,
          email: authData.user.email ?? "",
          name: (authData.user.user_metadata?.name as string) ?? "Everton Lauxen"
        });
      }
      toast.success("Bem-vindo de volta");
      router.push("/inicio");
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
          M
        </div>
        <CardTitle className="text-2xl">Money Mind</CardTitle>
        <CardDescription>
          {isDevLocal ? "Modo desenvolvimento local" : "Entre com suas credenciais"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isDevLocal ? (
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Supabase não configurado. Use o login local de desenvolvimento.
            </div>
            <Button onClick={devLogin} className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar como Everton Lauxen"}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="voce@empresa.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link href="#" className="text-xs text-muted-foreground hover:text-foreground">
                  Esqueceu?
                </Link>
              </div>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Não tem conta?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Criar agora
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
