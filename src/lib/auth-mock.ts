// Mock auth system
export type User = {
  id: string;
  email: string;
  role: "admin" | "viewer";
};

export const mockUser: User = {
  id: "user-1",
  email: "admin@rotadominios.com",
  role: "admin",
};

export function getCurrentUser(): User | null {
  const stored = localStorage.getItem("auth-user");
  return stored ? JSON.parse(stored) : null;
}

export function setCurrentUser(user: User | null) {
  if (user) {
    localStorage.setItem("auth-user", JSON.stringify(user));
  } else {
    localStorage.removeItem("auth-user");
  }
}

export function login(email: string, password: string): Promise<User> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email === "admin@rotadominios.com" && password === "admin123") {
        const user = { ...mockUser, email };
        setCurrentUser(user);
        resolve(user);
      } else if (email === "viewer@rotadominios.com" && password === "viewer123") {
        const user = { ...mockUser, email, role: "viewer" as const };
        setCurrentUser(user);
        resolve(user);
      } else {
        reject(new Error("Credenciais inválidas"));
      }
    }, 1000);
  });
}

export function logout() {
  setCurrentUser(null);
}