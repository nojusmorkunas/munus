export interface User {
  id: number
  username: string
  displayName: string
  birthday: string
  isAdmin: boolean
  currency: string
  locale: string
  avatarUrl: string
  publicToken: string
}

export interface PublicUser {
  displayName: string
  avatarUrl: string
  birthday: string
}

export interface PublicItemView {
  id: number
  name: string
  description: string
  url: string
  price: string
  currency: string
  imageUrl: string
  priority: number
  claimed: boolean
  availabilityStatus: string
  availabilityCheckedAt: string
  details: string
}

export interface ItemView {
  id: number
  userId: number
  name: string
  description: string
  url: string
  price: string
  currency: string
  imageUrl: string
  priority: number
  claimNote: string
  isPurchased: boolean
  isReceived: boolean
  isArchived: boolean
  sortOrder: number
  claimed: boolean
  claimedByMe: boolean
  claimedByName: string
  createdAt: string
  availabilityStatus: string
  availabilityCheckedAt: string
  /** Size, colour or variant the owner wants. */
  details: string
  /** A suggestion the list owner has not accepted yet. */
  isPending: boolean
  /** Who suggested the item. Only sent to the list owner. */
  suggestedByName: string
  suggestedByMe: boolean
  suggestionNote: string
}

export interface ItemInput {
  name: string
  description: string
  url: string
  price: string
  currency: string
  imageUrl: string
  details: string
  priority: number
}

export interface CreateUserInput {
  username: string
  password: string
  displayName: string
  birthday: string
  isAdmin: boolean
}

export interface AppSettings {
  currency: string
  locale: string
}

function handleUnauthorized() {
  // Keep auth handling out of individual pages. They only need to react to state.
  window.dispatchEvent(new CustomEvent("auth:unauthorized"))
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    // Sessions are cookie based, so every API request must include credentials.
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized()
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error ?? res.statusText), { status: res.status })
  }
  // Many write endpoints return 204 when the optimistic UI already has the data.
  if (res.status === 204) return undefined as T
  return res.json()
}

const GET = <T>(path: string) => request<T>("GET", path)
const POST = <T>(path: string, body: unknown) => request<T>("POST", path, body)
const PUT = <T>(path: string, body: unknown) => request<T>("PUT", path, body)
const DELETE_ = <T>(path: string) => request<T>("DELETE", path)

export const api = {
  auth: {
    me: () => GET<{ user: User }>("/api/auth/me"),
    login: (username: string, password: string) =>
      POST<{ user: User }>("/api/auth/login", { username, password }),
    logout: () => POST<void>("/api/auth/logout", {}),
    validateSignupToken: (token: string) => GET<void>(`/api/auth/signup/${token}`),
    signup: (token: string, data: { username: string; displayName: string; password: string }) =>
      POST<{ user: User }>(`/api/auth/signup/${token}`, data),
  },
  profile: {
    update: (data: { username: string; displayName: string; birthday: string; currency: string; locale: string; avatarUrl: string }) =>
      PUT<{ user: User }>("/api/profile", data),
    updatePassword: (currentPassword: string, newPassword: string) =>
      PUT<void>("/api/profile/password", { currentPassword, newPassword }),
  },
  settings: {
    get: () => GET<AppSettings>("/api/settings"),
    update: (data: AppSettings) => PUT<void>("/api/admin/settings", data),
  },
  users: {
    list: () => GET<User[]>("/api/users"),
    get: (id: number) => GET<User>(`/api/users/${id}`),
  },
  items: {
    mine: () => GET<ItemView[]>("/api/items/mine"),
    forUser: (userId: number) => GET<ItemView[]>(`/api/items/user/${userId}`),
    create: (data: ItemInput) => POST<ItemView>("/api/items", data),
    update: (id: number, data: ItemInput) => PUT<ItemView>(`/api/items/${id}`, data),
    delete: (id: number) => DELETE_<void>(`/api/items/${id}`),
    reorder: (ids: number[]) => PUT<void>("/api/items/reorder", { ids }),
    claim: (id: number) => POST<void>(`/api/items/${id}/claim`, { note: "" }),
    updateClaimNote: (id: number, note: string) => PUT<void>(`/api/items/${id}/claim`, { note }),
    unclaim: (id: number) => DELETE_<void>(`/api/items/${id}/claim`),
    purchase: (id: number) => POST<void>(`/api/items/${id}/purchase`, {}),
    unpurchase: (id: number) => DELETE_<void>(`/api/items/${id}/purchase`),
    received: (id: number) => POST<void>(`/api/items/${id}/received`, {}),
    unreceived: (id: number) => DELETE_<void>(`/api/items/${id}/received`),
    archive: (id: number) => POST<void>(`/api/items/${id}/archive`, {}),
    unarchive: (id: number) => DELETE_<void>(`/api/items/${id}/archive`),
    accept: (id: number, data: ItemInput) => POST<ItemView>(`/api/items/${id}/accept`, data),
  },
  suggestions: {
    create: (userId: number, data: ItemInput & { note: string }) =>
      POST<ItemView>(`/api/users/${userId}/suggestions`, data),
    count: () => GET<{ count: number }>("/api/suggestions/count"),
  },
  public: (token: string) =>
    GET<{ user: PublicUser; items: PublicItemView[] }>(`/api/public/${token}`),
  scrape: (url: string) =>
    GET<{ name: string; description: string; price: string; image: string; availabilityStatus: string; availabilityCheckedAt: string }>(
      `/api/scrape?url=${encodeURIComponent(url)}`
    ),
  upload: async (file: File): Promise<string> => {
    // File uploads use FormData, not the JSON helper above.
    const form = new FormData()
    form.append("image", file)
    const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: form })
    if (!res.ok) {
      if (res.status === 401) handleUnauthorized()
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error ?? res.statusText)
    }
    const data = await res.json()
    return data.url as string
  },
  admin: {
    createUser: (data: CreateUserInput) => POST<User>("/api/admin/users", data),
    deleteUser: (id: number) => DELETE_<void>(`/api/admin/users/${id}`),
    updatePassword: (id: number, password: string) =>
      PUT<void>(`/api/admin/users/${id}/password`, { password }),
    createSignupLink: () => POST<{ token: string }>("/api/admin/signup-links", {}),
  },
}
