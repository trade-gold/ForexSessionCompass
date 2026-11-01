import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/site";
import { useAuth } from "@/components/AuthProvider";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/lib/supabase";
import { describeAuthError } from "@/lib/auth-messages";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in | Forex Time Tools" },
      { name: "description", content: "Log in to your academy account for Forex Session Compass." },
      { property: "og:title", content: "Log in | Forex Time Tools" },
      { property: "og:description", content: "Log in to your academy account for Forex Session Compass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginPage() {
  const { session, loading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [authCallbackNotice, setAuthCallbackNotice] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errDesc = params.get("error_description") ?? hashParams.get("error_description");
    if (errDesc) {
      setServerError(describeAuthError(new Error(errDesc)));
    } else if (hashParams.get("type") === "signup" || params.get("confirmed") === "1") {
      setAuthCallbackNotice("Your email has been confirmed. Log in below to access your academy portal.");
    }
  }, []);

  if (!loading && session) return <Navigate to="/academy" replace />;
  if (!supabase) return <ServiceUnavailable />;

  const onSubmit = async (values: LoginValues) => {
    if (!supabase) return;
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) setServerError(describeAuthError(error));
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10 md:py-16">
      <PageHeader eyebrow="Academy login" title="Log in to your account">
        Access your academy subscription status, white-label branding configuration, and student dashboard links.
      </PageHeader>

      <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
        {authCallbackNotice && (
          <p
            role="status"
            className="mb-5 rounded-md border border-up/40 bg-up/10 px-3 py-2 text-sm text-up"
          >
            {authCallbackNotice}
          </p>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {serverError && (
              <p
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-foreground"
              >
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </Form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New academy?{" "}
        <Link to="/register" className="text-info hover:underline">
          Register your academy
        </Link>
      </p>
    </div>
  );
}
