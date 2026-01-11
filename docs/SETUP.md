# 🚀 AdScreen Pro - Complete Setup Guide

**Follow these steps exactly to get your platform running on Replit Pro in under 30 minutes!**

---

## ✅ **PREREQUISITES**

Before starting, make sure you have:

- [ ] **Replit Pro account** (you already have this!)
- [ ] **Computer with internet** (obviously!)
- [ ] **30 minutes of time** (that's it!)

---

## 📦 **PART 1: UPLOAD TO REPLIT (5 minutes)**

### **Step 1.1: Create New Repl**

1. Go to [https://replit.com](https://replit.com)
2. Click the **"+ Create"** button (top right)
3. Choose **"Import from Upload"**

### **Step 1.2: Upload Project**

1. Click **"Upload ZIP"**
2. Select the `adscreen-pro.zip` file
3. Wait for upload (30 seconds - 1 minute)
4. Replit automatically extracts everything
5. You should see all folders: `backend/`, `frontend/`, `database/`, etc.

### **Step 1.3: Verify Upload**

Check that these files exist:
- ✅ `server.js`
- ✅ `package.json`
- ✅ `.replit`
- ✅ `backend/` folder
- ✅ `frontend/` folder
- ✅ `database/schema.sql`
- ✅ `README.md`

---

## 🔐 **PART 2: GET API KEYS (10 minutes)**

### **Step 2.1: Gemini AI Key** (FREE)

1. Open new tab: [https://ai.google.dev](https://ai.google.dev)
2. Click **"Get API Key"**
3. Sign in with Google
4. Click **"Create API key"**
5. **Copy the key** (starts with `AI...`)
6. Save it somewhere (notepad, etc.)

**Cost:** FREE (1,500 requests/day)

---

### **Step 2.2: Stripe Keys** (FREE to start)

1. Open new tab: [https://stripe.com](https://stripe.com)
2. Create account (or sign in)
3. Click **"Developers"** in top menu
4. Click **"API keys"**
5. Find **"Publishable key"** - click **"Reveal test key"**
6. **Copy it** (starts with `pk_test_`)
7. Find **"Secret key"** - click **"Reveal test key"**
8. **Copy it** (starts with `sk_test_`)

**Set up Webhook:**
1. Still in Stripe dashboard, click **"Webhooks"**
2. Click **"Add endpoint"**
3. For URL, enter: `https://YOUR-REPL-NAME.YOUR-USERNAME.repl.co/api/payment/webhook`
   - Replace `YOUR-REPL-NAME` and `YOUR-USERNAME` with your actual Replit info
4. Click **"Select events"**
5. Search for and select: **"payment_intent.succeeded"**
6. Click **"Add endpoint"**
7. Click on the webhook you just created
8. **Copy the "Signing secret"** (starts with `whsec_`)

**Cost:** FREE to set up, 2.9% + $0.30 per transaction when you make sales

---

### **Step 2.3: Yodeck API Key**

1. Open new tab: [https://yodeck.com](https://yodeck.com)
2. Sign into your Yodeck account
3. Click your profile icon → **"Settings"**
4. Click **"API"** tab
5. Click **"Generate API Key"**
6. **Copy the key**

**Cost:** $0 (you already have Yodeck!)

---

### **Step 2.4: Generate JWT Secret**

This is a random string for security. Generate one:

**Option A - Online Generator:**
1. Go to: [https://randomkeygen.com](https://randomkeygen.com)
2. Copy any "Fort Knox Password"

**Option B - Terminal:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔧 **PART 3: CONFIGURE REPLIT (5 minutes)**

### **Step 3.1: Add Secrets**

In your Replit:

1. Click the **🔒 "Secrets"** icon in left sidebar
2. Click **"New secret"**
3. Add these **ONE BY ONE**:

```
Key: DATABASE_URL
Value: (This is auto-provided by Replit - check if it's already there!)

Key: JWT_SECRET
Value: [paste your random string from Step 2.4]

Key: GEMINI_API_KEY
Value: [paste your Gemini key from Step 2.1]

Key: STRIPE_SECRET_KEY
Value: [paste your Stripe secret key - starts with sk_test_]

Key: STRIPE_PUBLISHABLE_KEY
Value: [paste your Stripe publishable key - starts with pk_test_]

Key: STRIPE_WEBHOOK_SECRET
Value: [paste your Stripe webhook secret - starts with whsec_]

Key: YODECK_API_KEY
Value: [paste your Yodeck API key from Step 2.3]
```

### **Step 3.2: Verify Secrets**

You should have **7 secrets** total:
- ✅ DATABASE_URL
- ✅ JWT_SECRET
- ✅ GEMINI_API_KEY
- ✅ STRIPE_SECRET_KEY
- ✅ STRIPE_PUBLISHABLE_KEY
- ✅ STRIPE_WEBHOOK_SECRET
- ✅ YODECK_API_KEY

---

## 💾 **PART 4: SET UP DATABASE (3 minutes)**

### **Step 4.1: Install Dependencies**

In Replit **Shell** (bottom pane), run:

```bash
npm run install-all
```

**Wait 2-3 minutes** for installation to complete.

### **Step 4.2: Create Database Tables**

In the Shell, run:

```bash
npm run db:setup
```

You should see:
```
✅ Connected to database
✅ Database schema created successfully!
🎉 Database setup complete!
```

If you see errors:
- Check that `DATABASE_URL` is in Secrets
- Make sure PostgreSQL is enabled in Replit
- Try restarting the Repl

---

## ▶️ **PART 5: START THE APP (2 minutes)**

### **Step 5.1: Run**

Click the big green **"Run"** button at the top!

### **Step 5.2: Wait for Startup**

You'll see in the console:
```
Installing dependencies...
Building frontend...
Starting server...

╔══════════════════════════════════════╗
║   🚀 AdScreen Pro API Server        ║
║                                      ║
║   Port: 3000                         ║
║   Environment: development           ║
╚══════════════════════════════════════╝
```

### **Step 5.3: Access Your App**

Your app is now live at:
```
https://YOUR-REPL-NAME.YOUR-USERNAME.repl.co
```

Replit shows this URL at the top of the output panel.

---

## 🧪 **PART 6: TEST THE APP (5 minutes)**

### **Test 6.1: Login as Admin**

1. Click the app URL
2. You should see the login page
3. Use default admin credentials:
   - **Email:** `admin@adscreenpro.com`
   - **Password:** `admin123`
4. Click **"Sign In"**

**Success:** You should see the admin dashboard!

### **Test 6.2: Register as Venue**

1. Click **"Logout"** (if logged in)
2. Click **"Register"**
3. Choose role: **"Venue"**
4. Fill in:
   - Email: `test.venue@gmail.com`
   - Password: `test123`
   - Full Name: `Test Barbershop`
   - Business Name: `Joe's Barber`
   - Address: `123 Main St, Raleigh, NC 27601`
5. Click **"Register"**

**Success:** You should see the venue dashboard!

### **Test 6.3: Register as Advertiser**

1. Logout
2. Register again as **"Advertiser"**
3. Email: `test.advertiser@gmail.com`
4. Fill in restaurant/business details
5. Click **"Register"**

**Success:** You should see the advertiser dashboard!

---

## 🎯 **YOU'RE DONE!**

### **Your Platform is Live! 🎉**

You now have:
- ✅ Full working application
- ✅ Three user portals (Admin, Venue, Advertiser)
- ✅ Payment processing ready
- ✅ AI image enhancement ready
- ✅ Database configured
- ✅ Secure authentication

### **What to do next:**

**Immediate:**
1. **Change admin password!**
   - Login as admin
   - Go to Settings
   - Update password

2. **Test payment flow:**
   - Login as advertiser
   - Go to "Add Funds"
   - Use test card: `4242 4242 4242 4242`
   - Verify balance increases

3. **Test ad upload:**
   - As advertiser, create campaign
   - Upload a test image
   - As admin, approve it
   - Verify it appears

**This week:**
1. Customize colors/logo (optional)
2. Test with 1-2 real venues
3. Upload real content
4. Test the full workflow

**Next week:**
1. Connect custom domain
2. Switch Stripe to live mode
3. Onboard first real customers
4. Start making money! 💰

---

## 🐛 **TROUBLESHOOTING**

### **"Cannot connect to database"**
**Fix:**
1. Check Secrets tab - is `DATABASE_URL` there?
2. In Shell: `echo $DATABASE_URL` - does it print a URL?
3. Restart the Repl (Stop → Run)

### **"Secrets not loaded"**
**Fix:**
1. Stop the app
2. Re-enter all secrets in Secrets tab
3. Restart the app

### **"Port 3000 already in use"**
**Fix:**
1. Stop the app
2. In Shell: `killall node`
3. Run again

### **"Frontend not loading"**
**Fix:**
1. In Shell: `cd frontend && npm install`
2. Restart app

### **"npm run install-all fails"**
**Fix:**
1. Run separately:
   ```bash
   npm install
   cd frontend && npm install
   ```

### **Still having issues?**
1. Check the README.md file
2. Review console errors (Shell output)
3. Verify all API keys are correct

---

## 📞 **NEED HELP?**

Check these files in your project:
- `README.md` - Full documentation
- `docs/API.md` - API endpoints
- `.env.example` - All required environment variables

---

## 🚀 **READY TO GROW?**

When you're ready to scale:
1. Add more venues
2. Onboard advertisers
3. Process payments
4. Monitor analytics
5. Expand to new markets

**Your AdScreen Pro platform is ready to make money!** 💰

---

**Congratulations! You did it!** 🎉

Now go test everything and start onboarding your first customers!
