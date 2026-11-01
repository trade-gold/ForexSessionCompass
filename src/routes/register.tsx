import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
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

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register your academy | Forex Time Tools" },
      { name: "description", content: "Register your academy account for Forex Session Compass." },
      { property: "og:title", content: "Register your academy | Forex Time Tools" },
      { property: "og:description", content: "Register your academy account for Forex Session Compass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegisterPage,
});

const registerSchema = z
  .object({
    academyName: z
      .string()
      .trim()
      .min(2, "Enter your academy name")
      .max(120, "Use 120 characters or fewer"),
    contactName: z
      .string()
      .trim()
      .min(2, "Enter the contact person's name")
      .max(120, "Use 120 characters or fewer"),
    email: z.string().trim().email("Enter a valid email address").max(254, "Email is too long"),
    phone: z.string().trim().max(40, "Use 40 characters or fewer").optional(),
    country: z.string().trim().max(80, "Use 80 characters or fewer").optional(),
    password: z.string().min(8, "Use at least 8 characters").max(72, "Use 72 characters or fewer"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

function RegisterPage() {
  const { session, loading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      academyName: "",
      contactName: "",
      email: "",
      phone: "",
      country: "",
      password: "",
      confirmPassword: "",
    },
  });

  if (!loading && session) return <Navigate to="/academy" replace />;
  if (!supabase) return <ServiceUnavailable />;

  const onSubmit = async (values: RegisterValues) => {
    if (!supabase) return;
    setServerError(null);
    const redirectOrigin = `${window.location.origin}/login?confirmed=1`;
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: redirectOrigin,
        data: {
          academy_name: values.academyName,
          contact_name: values.contactName,
          phone: values.phone ?? "",
          country: values.country ?? "",
        },
      },
    });
    if (error) {
      setServerError(describeAuthError(error));
      return;
    }
    if (!data.session) setConfirmationSent(true);
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10 md:py-16">
      <PageHeader eyebrow="Academy registration" title="Create your academy account">
        Registration only creates your account. Access starts after payment is verified and the
        administrator activates your account.
      </PageHeader>

      <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
        {confirmationSent ? (
          <div className="space-y-4" role="status">
            <p className="text-sm text-foreground">
              Your account was created. If email confirmation is enabled, check your inbox to verify your email address, then log in with your email and password to continue.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Go to log in</Link>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="academyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Academy name</FormLabel>
                      <FormControl>
                        <Input autoComplete="organization" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact person</FormLabel>
                      <FormControl>
                        <Input autoComplete="name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl>
                        <Input type="tel" autoComplete="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country (optional)</FormLabel>
                      <FormControl>
                        <Input autoComplete="country-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {serverError && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-foreground"
                >
                  {serverError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating account..." : "Create academy account"}
              </Button>
            </form>
          </Form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link to="/login" className="text-info hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
