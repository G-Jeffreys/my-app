# React Native + Expo + NativeWind + Zustand + Firebase Starter

A **minimal, production‑friendly starter** that fuses two of the most popular Expo boilerplates:

- **Frontend shell** → forked from `nascript/react-native-tailwind-zustand-boilerplate` (Expo Router + NativeWind + Zustand + TypeScript)
- **Backend wiring** → lifted from `expo-community/expo-firebase-starter` (Firebase v9 modular SDK, env‐driven config, auth provider)

The result gives you:

| Area        | Stack                                              |
| ----------- | -------------------------------------------------- |
| Navigation  | **Expo Router** (file‑based)                       |
| Styling     | **NativeWind** (Tailwind‑like utility classes)     |
| State       | **Zustand** (minimal global store)                 |
| Auth & Data | **Firebase Auth** (Google & Email) + **Firestore** |
| Dev/Build   | Expo SDK 50 +, EAS Build ready                     |

---

## 1 · Quick Start

```bash
npx create-expo-app my-app -t expo-template-blank-typescript --yes
cd my-app

# ① Install base frontend stack
npm i zustand nativewind
npx expo install expo-router
npx tailwindcss init -p

# ② Add Firebase SDK + Expo Google auth helper
npm i firebase expo-auth-session expo-random

# ③ Copy template files
curl -L https://raw.githubusercontent.com/<your‑repo‑url>/template.zip -o template.zip
unzip -o template.zip -d .

# ④ Run the dev server
npx expo start -c
```

> **Tip:** Replace the `curl` step with a `git clone` once you host the template in your GitHub organisation.

---

## 2 · Project Layout

```
my-app/
├── app/                 # Expo Router pages
│   ├── _layout.tsx      # Root layout (navigation container)
│   ├── index.tsx        # Landing screen
│   ├── (auth)/          # Public stack
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (protected)/     # Auth‑gated stack
│       └── home.tsx
│
├── config/
│   └── firebase.ts      # Firebase init
│
├── store/
│   └── useAuth.ts       # Zustand auth store
│
├── env.ts               # type‑safe env helper
├── tailwind.config.js
├── babel.config.js
└── .env                 # 🔒 NOT committed – holds Firebase keys
```

---

## 3 · Config Files

### 3.1 `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
};
```

### 3.2 `babel.config.js`

```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["nativewind/babel", "expo-router/babel"],
  };
};
```

### 3.3 Environment helper `env.ts`

```ts
// Basic runtime‑safe accessor
export const env = {
  FB_API_KEY: process.env.EXPO_PUBLIC_FB_API_KEY!,
  FB_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FB_AUTH_DOMAIN!,
  FB_PROJECT_ID: process.env.EXPO_PUBLIC_FB_PROJECT_ID!,
  FB_APP_ID: process.env.EXPO_PUBLIC_FB_APP_ID!,
};
```

Add the matching keys to `` (Expo automatically exposes vars prefixed with `EXPO_PUBLIC_`).

---

## 4 · Firebase Init (`config/firebase.ts`)

```ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { env } from "../env";

const firebaseConfig = {
  apiKey: env.FB_API_KEY,
  authDomain: env.FB_AUTH_DOMAIN,
  projectId: env.FB_PROJECT_ID,
  appId: env.FB_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

---

## 5 · Auth Store (`store/useAuth.ts`)

```ts
import { GoogleAuthProvider, signInWithCredential, onAuthStateChanged, User } from "firebase/auth";
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import create from "zustand";
import { auth } from "../config/firebase";

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  signInWithGoogle: async () => {
    const redirectUri = makeRedirectUri({ useProxy: true });
    const [request, , promptAsync] = useAuthRequest(
      {
        clientId: "<YOUR_GOOGLE_IOS_CLIENT_ID>",
        redirectUri,
        scopes: ["profile", "email"],
      },
      { authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth" }
    );
    const result = await promptAsync({ useProxy: true });
    if (result?.type === "success") {
      const { id_token } = result.params;
      const credential = GoogleAuthProvider.credential(id_token);
      await signInWithCredential(auth, credential);
    }
  },
  signOut: async () => auth.signOut(),
}));

// Listen for auth changes
onAuthStateChanged(auth, (firebaseUser) => {
  useAuth.setState({ user: firebaseUser, loading: false });
});
```

---

## 6 · Routing Example (`app/_layout.tsx`)

```tsx
import { Stack } from "expo-router";
import { useAuth } from "../store/useAuth";
import { ActivityIndicator } from "react-native";

export default function RootLayout() {
  const { user, loading } = useAuth();

  if (loading) return <ActivityIndicator className="flex-1" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="(protected)/home" />
      ) : (
        <>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)/login" />
        </>
      )}
    </Stack>
  );
}
```

---

## 7 · Sample Screens

### Landing (`app/index.tsx`)

```tsx
import { Link } from "expo-router";
import { View, Text } from "react-native";

export default function Landing() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-3xl font-bold mb-4">My App</Text>
      <Link href="/(auth)/login" className="bg-blue-500 px-4 py-2 rounded-lg text-white">
        Get Started
      </Link>
    </View>
  );
}
```

### Login (`app/(auth)/login.tsx`)

```tsx
import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../store/useAuth";

export default function Login() {
  const { signInWithGoogle } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl mb-6">Login</Text>
      <TouchableOpacity onPress={signInWithGoogle} className="bg-green-500 px-4 py-2 rounded-lg">
        <Text className="text-white">Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Home (`app/(protected)/home.tsx`)

```tsx
import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../store/useAuth";

export default function Home() {
  const { signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl">Welcome 👋</Text>
      <TouchableOpacity onPress={signOut} className="mt-6 bg-red-500 px-4 py-2 rounded-lg">
        <Text className="text-white">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 8 · EAS Build

```bash
npx expo install eas-cli
npx eas build:configure
# Then build for each platform
npx eas build --platform ios
npx eas build --platform android
```

Add `EAS_PROJECT_ID=...` to your `.env` if you use environment secrets.

---

## 9 · Next Steps

1. **RAG Ready DB** – keep Firestore documents flat (`/docs/{docId}`) with a `content` field that’s easy to vectorise.
2. **Analytics & Crashlytics** – `expo-firebase-analytics`, `expo-firebase-crashlytics`.
3. **Theming** – add Dark Mode via NativeWind `className` toggles.
4. **CI** – GitHub Actions → `eas build --non-interactive`.

Happy shipping! 🚀

