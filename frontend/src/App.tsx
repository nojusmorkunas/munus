import { createContext, useContext, useEffect, useState } from "react"
import { BrowserRouter, Navigate, Route, Routes, NavLink, useNavigate } from "react-router-dom"
import { api, type User } from "@/lib/api"
import { LayoutGrid, List, Settings, LogOut, User as UserIcon } from "lucide-react"
import { SettingsProvider } from "@/contexts/SettingsContext"
import UserAvatar from "@/components/UserAvatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import LoginPage from "@/pages/LoginPage"
import BrowsePage from "@/pages/BrowsePage"
import MyListPage from "@/pages/MyListPage"
import UserListPage from "@/pages/UserListPage"
import AdminPage from "@/pages/AdminPage"
import ProfilePage from "@/pages/ProfilePage"
import SignupPage from "@/pages/SignupPage"
import PublicListPage from "@/pages/PublicListPage"

interface AuthContextValue {
  user: User
  setUser: (u: User) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthContext")
  return ctx
}

function AppShell() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  async function logout() {
    await api.auth.logout()
    setUser(null as unknown as User)
  }

  const navItems = [
    { to: "/browse", label: "Browse", icon: <LayoutGrid size={20} /> },
    { to: "/my-list", label: "My List", icon: <List size={20} /> },
    ...(user.isAdmin ? [{ to: "/admin", label: "Admin", icon: <Settings size={20} /> }] : []),
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="flex items-center justify-between h-14 px-4 max-w-5xl mx-auto w-full gap-3">
          <span className="font-bold text-lg tracking-tight truncate">Munus</span>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-accent transition-colors outline-none">
              <UserAvatar user={user} className="w-7 h-7 text-sm" />
              <span className="sr-only">Account menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal">
                <p className="font-semibold">{user.displayName}</p>
                <p className="text-xs text-muted-foreground">@{user.username}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <UserIcon size={15} />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut size={15} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main
        className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6"
      >
        <Routes>
          <Route path="/" element={<Navigate to="/browse" replace />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/my-list" element={<MyListPage />} />
          <Route path="/users/:id" element={<UserListPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/admin"
            element={user.isAdmin ? <AdminPage /> : <Navigate to="/browse" replace />}
          />
        </Routes>
      </main>

      {/* Keep the main actions reachable on phones, especially one-handed. */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex-1 flex flex-col items-center justify-center min-h-[56px] gap-1 text-xs font-medium transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute top-0 left-0 right-0 h-0.5 bg-foreground transition-opacity duration-200 ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {item.icon}
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const isSignupRoute = window.location.pathname.startsWith("/signup/")
  const isPublicRoute = window.location.pathname.startsWith("/share/")

  useEffect(() => {
    // Central handler for expired sessions. API calls dispatch this on 401.
    const handler = () => setUser(null)
    window.addEventListener("auth:unauthorized", handler)
    return () => window.removeEventListener("auth:unauthorized", handler)
  }, [])

  useEffect(() => {
    // Signup and public share pages do not need the current user loaded first.
    if (isSignupRoute || isPublicRoute) {
      setLoading(false)
      return
    }
    api.auth
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [isSignupRoute])

  if (loading) return null

  if (isSignupRoute) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/signup/:token" element={<SignupPage onSignup={(u) => { setUser(u); window.location.replace("/") }} />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (isPublicRoute) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/share/:token" element={<PublicListPage />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (!user) {
    // No valid session, so stay on the login screen.
    return <LoginPage onLogin={setUser} />
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <SettingsProvider>
          <AppShell />
        </SettingsProvider>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
