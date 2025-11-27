# Custom Authentication Setup with Stack Auth + shadcn/ui

This project uses **custom shadcn/ui forms** connected to **Stack Auth's REST API backend**. You get beautiful UI with robust authentication infrastructure!

## ✅ What's Included

### 1. **shadcn/ui Components**
Beautiful, accessible UI components:
- `Button` - Multiple variants (default, outline, ghost, destructive)
- `Input` - Form input fields  
- `Label` - Form labels
- `Card` - Container components for layouts

Located in: `renderer/components/ui/`

### 2. **Stack Auth Integration**
- Connected to Stack Auth's REST API
- Handles authentication, sessions, and user management
- No need to build your own auth backend!

Located in: `renderer/contexts/AuthContext.tsx`

### 3. **Authentication Pages**
- `/login` - Beautiful sign in page
- `/signup` - Account creation page
- `/home` - Home page with auth status

## 🔧 Configuration

### Environment Variables

Your `.env.local` file in the `renderer` directory should contain:

```env
NEXT_PUBLIC_STACK_PROJECT_ID=1800c80a-d427-4ff7-a5d3-bd1048129b3b
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=pck_46tdrzhnm04vnk3gqrrsfqdp7y08hxt09fe9qj9sx6hj8
NEXT_PUBLIC_STACK_API_URL=https://api.stack-auth.com/api/v1
```

These are already configured! 

### Stack Auth Dashboard Configuration

1. Go to [https://app.stack-auth.com/](https://app.stack-auth.com/)
2. Navigate to your project settings
3. Configure **Allowed Origins**:
   - Add `http://localhost:8888` (for development)
   - Add your production URL when deploying

## 📖 How It Works

### Authentication Flow

1. **Sign Up**: User fills form → Calls Stack Auth API `/auth/password/sign-up` → Returns access token → Saves to localStorage
2. **Login**: User fills form → Calls Stack Auth API `/auth/password/sign-in` → Returns access token → Saves to localStorage
3. **Session Check**: On app load → Checks localStorage for token → Calls `/users/me` to get user data
4. **Logout**: User clicks logout → Calls `/auth/sessions/current` DELETE → Clears localStorage

### Stack Auth API Endpoints Used

All requests go to: `https://api.stack-auth.com/api/v1`

Required headers:
```typescript
{
  'X-Stack-Access-Type': 'client',
  'X-Stack-Project-Id': 'your_project_id',
  'X-Stack-Publishable-Client-Key': 'your_key',
  'X-Stack-Access-Token': 'user_token' // for authenticated requests
}
```

**Endpoints:**
- `POST /auth/password/sign-up` - Create new account
- `POST /auth/password/sign-in` - Login
- `GET /users/me` - Get current user
- `PATCH /users/me` - Update user profile
- `POST /auth/sessions/refresh` - Refresh expired token
- `DELETE /auth/sessions/current` - Logout

## 📖 Usage Examples

### Check if User is Logged In

```tsx
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { user, isLoading } = useAuth()
  
  if (isLoading) {
    return <div>Loading...</div>
  }
  
  if (!user) {
    return <div>Please log in</div>
  }
  
  return <div>Welcome, {user.primaryEmail}!</div>
}
```

### Protect a Page

```tsx
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

function ProtectedPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])
  
  if (isLoading) {
    return <div>Loading...</div>
  }
  
  if (!user) {
    return null
  }
  
  return <div>Protected content</div>
}
```

### Login Programmatically

```tsx
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { login } = useAuth()
  
  const handleLogin = async () => {
    try {
      await login('user@example.com', 'password123')
      // User is now logged in
    } catch (error) {
      console.error('Login failed:', error)
    }
  }
  
  return <button onClick={handleLogin}>Login</button>
}
```

### Access User Data

```tsx
const { user } = useAuth()

// Available user properties:
user.id                // User ID
user.primaryEmail      // Primary email
user.displayName       // Display name
user.profileImageUrl   // Profile image URL
```

### Logout

```tsx
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { logout } = useAuth()
  
  return (
    <button onClick={logout}>
      Sign Out
    </button>
  )
}
```

## 🎨 Customizing the UI

### Modify Form Fields

Edit `renderer/pages/login.tsx` or `renderer/pages/signup.tsx` to add/remove fields or change validation.

### Add Social Login (OAuth)

Stack Auth supports OAuth providers. Update the login page to add:

```tsx
import { stackAuthFetch } from '../contexts/AuthContext'

const handleGoogleLogin = async () => {
  // Initialize OAuth flow with Stack Auth
  const response = await stackAuthFetch('/auth/oauth/authorize', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'google',
      redirect_uri: 'http://localhost:8888/oauth/callback',
    }),
  })
  
  const { authorization_url } = await response.json()
  window.location.href = authorization_url
}

<Button variant="outline" onClick={handleGoogleLogin}>
  Continue with Google
</Button>
```

### Change Theme Colors

Update `renderer/styles/globals.css` to modify the color scheme:

```css
:root {
  --primary: 221.2 83.2% 53.3%; /* Change primary color */
  --radius: 0.5rem; /* Change border radius */
}
```

### Add More shadcn/ui Components

Browse available components at: [shadcn/ui components](https://ui.shadcn.com/docs/components)

Create them in `renderer/components/ui/` following the same pattern.

## 🚀 Features

- ✅ Beautiful, modern UI with shadcn/ui
- ✅ Stack Auth backend (no custom auth backend needed!)
- ✅ Form validation & error handling
- ✅ Loading states
- ✅ Persistent sessions with token refresh
- ✅ Dark mode support
- ✅ Fully typed with TypeScript
- ✅ Works with Electron + static export
- ✅ Password authentication
- ✅ OAuth support (Google, GitHub, etc.)
- ✅ Email verification (via Stack Auth dashboard)
- ✅ User management dashboard

## 🔒 Security Features (via Stack Auth)

Stack Auth handles all the security heavy-lifting:
- ✅ Password hashing (bcrypt)
- ✅ JWT token generation and validation
- ✅ Session management
- ✅ Token refresh
- ✅ CORS protection
- ✅ Rate limiting
- ✅ Email verification
- ✅ Password reset flows

## 🧪 Testing Your Setup

1. **Start the dev server:**
   ```bash
   yarn dev
   ```

2. **Test Signup:**
   - Navigate to `/signup`
   - Fill out the form
   - Create an account
   - Check Stack Auth dashboard to see the new user

3. **Test Login:**
   - Navigate to `/login`
   - Sign in with your credentials
   - Should redirect to `/home` showing your info

4. **Test Logout:**
   - Click "Sign Out" on home page
   - Should clear session and show login buttons

5. **Test Persistence:**
   - Login, then close and reopen the app
   - Should remain logged in

## 📊 Stack Auth Dashboard

Access your dashboard at [https://app.stack-auth.com/](https://app.stack-auth.com/)

Features available:
- View all users
- Manage authentication settings
- Configure OAuth providers
- Set up email templates
- View analytics
- Manage API keys
- Configure security settings

## 🎯 Next Steps

1. ✅ Environment variables are configured
2. ✅ Custom UI is set up
3. ✅ Stack Auth API is integrated
4. Test the authentication flow (yarn dev)
5. Configure OAuth providers in Stack dashboard (optional)
6. Customize the UI to match your brand
7. Add password reset functionality
8. Set up email verification in Stack dashboard
9. Add protected routes to your app
10. Configure production URLs

## 💡 Advanced Features

### Add Forgot Password

Create a forgot password page:

```tsx
const handleForgotPassword = async (email: string) => {
  const response = await stackAuthFetch('/auth/password/reset/send-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  
  if (response.ok) {
    // Email sent successfully
  }
}
```

### Email Verification

Stack Auth automatically sends verification emails. Configure email templates in the dashboard.

### Teams & Organizations

Stack Auth supports teams. Enable in the dashboard and use the Teams API.

### Role-Based Access Control (RBAC)

Configure permissions in the Stack Auth dashboard and check them in your app.

## 🆚 Comparison with Original Approach

**Before (Stack Auth SDK):**
- ❌ Incompatible with static export
- ❌ SSR/Suspense errors
- ❌ Black-box UI components
- ❌ Limited customization

**Now (Custom UI + Stack Auth API):**
- ✅ Works perfectly with static export
- ✅ Full UI control with shadcn
- ✅ Beautiful, modern design
- ✅ Stack Auth's robust backend
- ✅ Best of both worlds!

## 📚 Resources

- [Stack Auth REST API Docs](https://docs.stack-auth.com/rest-api/overview)
- [Stack Auth Dashboard](https://app.stack-auth.com/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Stack Auth Discord](https://discord.stack-auth.com/)

---

**You now have enterprise-grade authentication with a beautiful custom UI!** 🎉
