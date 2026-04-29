# Admin Dashboard Access Debugging Guide

## Step-by-Step Debugging

### Step 1: Check if you're logged in

1. Open your browser's Developer Tools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click on **Local Storage** → `http://localhost:3000`
4. Look for these keys:
   - `token` - Should exist if you're logged in
   - `user` - Should exist if you're logged in

**If `token` or `user` don't exist**: You're not logged in. Go to `/auth` and log in first.

### Step 2: Check your user role in localStorage

1. In the same Local Storage view, click on the `user` key
2. You should see JSON like:
   ```json
   {
     "id": "...",
     "email": "your@email.com",
     "role": "admin",
     ...
   }
   ```

**If `role` is `"user"` or missing**: You need to:
1. Verify you're an admin in the database (see Step 3)
2. Log out completely
3. Log back in to refresh the user data

### Step 3: Verify you're an admin in the database

Run this command to check and promote yourself:

```bash
cd flight-match-finder/overlap/backend
node src/scripts/makeAdmin.js your-email@example.com
```

Replace `your-email@example.com` with your actual email.

**Expected output:**
- If you're already admin: `ℹ️  User "your@email.com" is already an admin`
- If promoted: `✅ Successfully promoted "your@email.com" to admin role`

### Step 4: Refresh your session

After being promoted to admin (or confirming you're already admin):

1. **Log out completely** from the web app
   - Click your profile/avatar in top right
   - Click "Logout"

2. **Clear localStorage** (optional but recommended):
   - Open Developer Tools (F12)
   - Go to Application → Local Storage → `http://localhost:3000`
   - Right-click and "Clear" or delete the `token` and `user` keys manually

3. **Log back in**:
   - Go to `http://localhost:3000/auth`
   - Enter your credentials
   - This will fetch fresh user data from the server with the updated role

4. **Try `/admin` again**:
   - Go to `http://localhost:3000/admin`
   - It should work now!

### Step 5: Verify in browser console

After logging back in, check the console:

1. Open Developer Tools (F12)
2. Go to **Console** tab
3. Type this and press Enter:
   ```javascript
   JSON.parse(localStorage.getItem('user'))
   ```
4. Check the `role` field - it should say `"admin"`

## Common Issues

### Issue: "I'm logged in but still see login page"

**Cause**: Your user object in localStorage has `role: "user"` instead of `role: "admin"`

**Fix**: 
1. Verify you're admin in database (Step 3)
2. Log out and log back in (Step 4)

### Issue: "makeAdmin.js says user not found"

**Cause**: Email doesn't match exactly (case-sensitive)

**Fix**: 
1. Check the exact email you used to register
2. Make sure it matches exactly (including case)
3. Or check your database directly

### Issue: "I see 'Access denied' message instead of login"

**Cause**: You're logged in but not an admin

**Fix**: 
1. Run `makeAdmin.js` to promote yourself
2. Log out and log back in

## Quick Test Script

Run this in your browser console (F12 → Console) to check your current status:

```javascript
const user = JSON.parse(localStorage.getItem('user') || 'null');
const token = localStorage.getItem('token');

console.log('Logged in:', !!token);
console.log('User data:', user);
console.log('Is admin:', user?.role === 'admin');
console.log('Email:', user?.email);
```

If `Is admin: false`, you need to:
1. Run `makeAdmin.js` with your email
2. Log out and log back in


