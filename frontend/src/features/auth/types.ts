export type User = {
  id: number;
  email: string;
};

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: User }
  | { status: "anonymous" }
  | { status: "error"; message: string };

export type LoginInput = {
  email: string;
  password: string;
};

export type RegistrationInput = LoginInput & {
  password_confirmation: string;
};
