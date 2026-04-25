type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "data-port-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function createThemeStore() {
  const stored = typeof localStorage !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as Theme | null) : null;
  let current = $state<Theme>(stored ?? "system");

  if (typeof window !== "undefined") {
    applyTheme(current);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (current === "system") applyTheme("system");
    });
  }

  return {
    get current() { return current; },
    set(theme: Theme) {
      current = theme;
      localStorage.setItem(STORAGE_KEY, theme);
      applyTheme(theme);
    },
  };
}

export const themeStore = createThemeStore();
