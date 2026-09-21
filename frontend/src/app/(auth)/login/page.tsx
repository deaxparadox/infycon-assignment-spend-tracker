import { LoginForm } from "@/features/auth/login-form";
import { safeNextPath } from "@/features/auth/safe-redirect";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextValue = typeof params.next === "string" ? params.next : null;

  return (
    <LoginForm
      nextPath={safeNextPath(nextValue)}
      registrationComplete={params.registered === "1"}
      logoutIncomplete={params.logout === "incomplete"}
    />
  );
}
