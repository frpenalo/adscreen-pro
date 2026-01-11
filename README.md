# 🚀 AdScreen Pro - Digital Advertising Marketplace

**A three-sided marketplace connecting barbershops/salons with local advertisers through AI-powered digital screens.**

---

## 📋 **PROJECT OVERVIEW**

AdScreen Pro is a complete web application built for Replit Pro that enables:

- **Venues** (barbershops/salons): Host free screens, earn 30% commission
- **Advertisers** (restaurants/businesses): Upload photos/videos, pay $25-40/week per location
- **Platform Admin**: Manage approvals, handle payments, monitor performance

### **Technology Stack**

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (Replit included)
- **Frontend**: React 18 (Progressive Web App)
- **Payments**: Stripe
- **AI Enhancement**: Google Gemini API
- **Screen Management**: Yodeck API
- **Hosting**: Replit Pro

---

## ⚡ **QUICK START ON REPLIT**

### **Step 1: Upload Project**

1. Go to [Replit.com](https://replit.com)
2. Click **"Create Repl"**
3. Choose **"Import from Upload"**
4. Upload the `adscreen-pro.zip` file
5. Replit will auto-extract everything

### **Step 2: Set Up Database**

1. Replit Pro includes PostgreSQL automatically
2. Get your database URL from Replit's **Secrets** tab (it's auto-generated as `DATABASE_URL`)
3. Run the database setup:

```bash
npm run db:setup
```

This creates all tables, indexes, and the default admin account.

### **Step 3: Configure API Keys (Secrets)**

Click the **🔒 Secrets** icon in Replit sidebar and add:

```env
# Database (already provided by Replit)
DATABASE_URL=postgresql://...

# JWT Secret (generate random string)
JWT_SECRET=your-super-secret-random-string-here

# Gemini AI (get from ai.google.dev)
GEMINI_API_KEY=your-gemini-api-key

# Stripe (get from stripe.com)
STRIPE_SECRET_KEY=sk_test_your-stripe-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Yodeck (get from yodeck.com dashboard)
YODECK_API_KEY=your-yodeck-api-key

# Email (optional, for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### **Step 4: Install Dependencies**

```bash
npm run install-all
```

This installs both backend and frontend dependencies.

### **Step 5: Run the App**

Click the big green **"Run"** button in Replit!

The app will start at: `https://your-repl-name.username.repl.co`

---

## 🔑 **API KEYS SETUP GUIDE**

### **1. Gemini API (AI Image Enhancement)**

1. Visit: [https://ai.google.dev](https://ai.google.dev)
2. Sign in with Google account
3. Click **"Get API Key"**
4. Create new project
5. Copy the API key
6. Add to Replit Secrets as `GEMINI_API_KEY`

**Cost**: FREE tier (1,500 requests/day)

### **2. Stripe (Payments)**

1. Visit: [https://stripe.com](https://stripe.com)
2. Create account
3. Go to **Developers → API Keys**
4. Copy **Publishable Key** and **Secret Key**
5. For test mode, use keys starting with `pk_test_` and `sk_test_`
6. Add to Replit Secrets

**For Webhooks:**
1. Go to **Developers → Webhooks**
2. Add endpoint: `https://your-repl.username.repl.co/api/payment/webhook`
3. Select event: `payment_intent.succeeded`
4. Copy **Signing Secret** (starts with `whsec_`)
5. Add as `STRIPE_WEBHOOK_SECRET`

**Cost**: 2.9% + $0.30 per transaction

### **3. Yodeck API (Screen Management)**

1. Log into your Yodeck account
2. Go to **Settings → API**
3. Generate API key
4. Copy and add to Replit Secrets as `YODECK_API_KEY`

**Cost**: $0 (you already have Yodeck)

---

## 👤 **DEFAULT ADMIN ACCOUNT**

After running `npm run db:setup`, a default admin account is created:

- **Email**: `admin@adscreenpro.com`
- **Password**: `admin123`

**⚠️ IMPORTANT**: Change this password immediately after first login!

To change admin password:
1. Log in as admin
2. Go to Settings
3. Update password
4. Or update directly in database:

```bash
# Generate new password hash
node -e "console.log(require('bcryptjs').hashSync('NEW_PASSWORD', 10))"

# Update in database
# Use Replit's database tool or SQL query
```

---

## 📁 **PROJECT STRUCTURE**

```
adscreen-pro/
├── server.js                 # Main Express server
├── package.json              # Backend dependencies
├── .replit                   # Replit configuration
├── .env.example              # Environment variables template
│
├── backend/
│   ├── config/
│   │   └── database.js       # PostgreSQL connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── adminController.js
│   │   ├── venueController.js
│   │   ├── advertiserController.js
│   │   └── paymentController.js
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   └── upload.js         # File uploads (Multer)
│   └── routes/
│       ├── auth.js
│       ├── admin.js
│       ├── venue.js
│       ├── advertiser.js
│       └── payment.js
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React app
│   │   ├── components/       # Reusable components
│   │   ├── pages/            # Page components
│   │   ├── context/          # React Context (Auth, etc.)
│   │   └── utils/            # Helper functions
│   ├── public/
│   └── package.json          # Frontend dependencies
│
├── database/
│   ├── schema.sql            # Database schema
│   └── setup.js              # Setup script
│
└── docs/
    └── API.md                # API documentation
```

---

## 🌐 **CONNECT CUSTOM DOMAIN**

### **On Replit:**

1. Go to your Repl settings
2. Click **"Domains"** tab
3. Click **"Link custom domain"**
4. Enter your domain: `adscreenpro.com`

### **On Namecheap (or your domain registrar):**

1. Go to domain management
2. Find **DNS settings**
3. Add **A Record**:
   - **Host**: `@`
   - **Value**: (IP provided by Replit)
4. Add **CNAME Record**:
   - **Host**: `www`
   - **Value**: `your-repl.username.repl.co`
5. Save changes (takes 24-48 hours to propagate)

---

## 🧪 **TESTING THE APPLICATION**

### **Test Admin Portal:**

1. Go to `https://your-repl.username.repl.co/login`
2. Log in with admin credentials
3. Navigate to `/admin/dashboard`
4. Verify:
   - Dashboard loads
   - Stats display
   - Can view pending ads
   - Can manage venues

### **Test Venue Registration:**

1. Click **"Register"**
2. Select **"Venue"** role
3. Fill in barbershop/salon details
4. Submit registration
5. Log in
6. Navigate to `/venue/dashboard`
7. Verify:
   - Earnings display
   - Can request payout
   - Performance stats visible

### **Test Advertiser Flow:**

1. Register as **"Advertiser"**
2. Create a campaign
3. Upload an image
4. Select venue locations
5. Submit for approval
6. Admin approves
7. Verify ad appears in campaign

### **Test Payments:**

1. As advertiser, go to **Add Funds**
2. Use Stripe test card: `4242 4242 4242 4242`
3. Expiry: Any future date
4. CVC: Any 3 digits
5. ZIP: Any 5 digits
6. Verify balance increases

---

## 📊 **DATABASE MANAGEMENT**

### **View Data:**

Use Replit's built-in database viewer:
1. Click **Database** icon in sidebar
2. Browse tables
3. Run SQL queries

### **Backup Database:**

```bash
# Export all data
pg_dump $DATABASE_URL > backup.sql

# Restore from backup
psql $DATABASE_URL < backup.sql
```

### **Reset Database:**

```bash
# Drop all tables (⚠️ WARNING: Deletes all data!)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Recreate tables
npm run db:setup
```

---

## 🔧 **TROUBLESHOOTING**

### **"Cannot connect to database"**

- Verify `DATABASE_URL` is in Replit Secrets
- Check PostgreSQL is enabled in Replit dashboard
- Restart the Repl

### **"API key invalid"**

- Double-check all API keys in Secrets
- Ensure no extra spaces in keys
- Verify keys are for the correct environment (test vs production)

### **"File upload fails"**

- Check `uploads/` folder exists
- Verify file size is under 10MB
- Check file type is image/video

### **"Stripe webhook not working"**

- Verify webhook URL in Stripe dashboard
- Check `STRIPE_WEBHOOK_SECRET` matches
- Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/payment/webhook`

### **Frontend not loading:**

- Run `cd frontend && npm install`
- Check console for errors
- Verify backend is running on port 3000

---

## 🚀 **DEPLOYMENT CHECKLIST**

Before going live with real customers:

### **Security:**
- [ ] Change default admin password
- [ ] Set strong `JWT_SECRET`
- [ ] Switch Stripe to production mode
- [ ] Enable HTTPS (Replit does this automatically)
- [ ] Set up proper CORS origins

### **Configuration:**
- [ ] Update commission rates if needed
- [ ] Set minimum payout amount
- [ ] Configure email notifications
- [ ] Test all payment flows

### **Testing:**
- [ ] Test full user registration flows
- [ ] Test ad upload and approval
- [ ] Test payment processing
- [ ] Test payout requests
- [ ] Test on mobile devices

### **Content:**
- [ ] Add your logo
- [ ] Update color scheme if desired
- [ ] Add terms of service
- [ ] Add privacy policy
- [ ] Add contact information

---

## 💰 **MONTHLY COST BREAKDOWN**

### **Replit Pro:** $20/month ✅ (You already have this!)

### **APIs (Starting costs):**
- Gemini: **$0** (free tier, 1,500 req/day)
- Stripe: **$0** base fee + 2.9% + $0.30 per transaction
- Yodeck: **$0** (you already have it)
- Email (Gmail): **$0** (using personal Gmail)

### **Domain:**
- Namecheap: **$12/year** (~$1/month)

**Total first month: $21**
**Monthly recurring: $20**

As you grow, costs scale with usage:
- Stripe fees scale with revenue (good problem!)
- Gemini may need paid tier after 1,500 images/day
- Email may need dedicated service (SendGrid, Mailgun)

---

## 📈 **SCALING CONSIDERATIONS**

### **When you reach 50+ venues:**

**Database Optimization:**
- Add more indexes
- Enable query caching
- Consider read replicas

**Performance:**
- Implement Redis caching
- Use CDN for uploaded images
- Optimize image sizes

**Infrastructure:**
- Replit Pro can handle 100+ concurrent users
- For 500+ venues, consider dedicated servers

---

## 📞 **SUPPORT & NEXT STEPS**

### **Week 1 (MVP Testing):**
- Test with 2-3 beta venues
- Collect feedback
- Fix any bugs

### **Week 2 (Full Launch):**
- Onboard 10-20 venues
- Add video upload feature
- Implement Spanish translation
- Set up analytics

### **Week 3 (Growth):**
- Start marketing
- Refine features based on feedback
- Add automated emails
- Improve analytics

---

## ⚖️ **LICENSE**

Proprietary - All rights reserved

---

## 🎉 **YOU'RE READY TO LAUNCH!**

Just click **RUN** in Replit and your entire platform will be live!

**Need help?** Check the troubleshooting section or review the API documentation in `/docs/API.md`.

**Happy building!** 🚀
