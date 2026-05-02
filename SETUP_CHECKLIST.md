# LinearVoice Setup Checklist

## Prerequisites ✓

- [x] Node.js 18+ installed
- [x] Git repository initialized
- [x] v0 project created

## External Services to Set Up

### 1. Upstash Redis (REQUIRED)
- [ ] Go to https://upstash.com/console/redis
- [ ] Create a new Redis database
- [ ] Copy REST URL and token
- [ ] Add to `.env.local`:
  ```
  UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
  UPSTASH_REDIS_REST_TOKEN=xxx
  ```

### 2. Kapso WhatsApp API (REQUIRED)
- [ ] Sign up at https://kapso.dev
- [ ] Create a WhatsApp application
- [ ] Get your phone number ID
- [ ] Generate authentication token
- [ ] Add to `.env.local`:
  ```
  KAPSO_API_BASE=https://api.kapso.io
  KAPSO_AUTH_TOKEN=xxx
  KAPSO_PHONE_ID=xxx
  KAPSO_WEBHOOK_TOKEN=your-secure-token
  ```

### 3. Linear Integration (REQUIRED)
- [ ] Go to https://linear.app/settings/api
- [ ] Create a new API key
- [ ] Copy your workspace ID
- [ ] Add to `.env.local`:
  ```
  LINEAR_API_KEY=lin_api_xxx
  LINEAR_WORKSPACE_ID=your-workspace-slug
  ```

### 4. ElevenLabs (OPTIONAL - for voice)
- [ ] Sign up at https://elevenlabs.io
- [ ] Create API key in account settings
- [ ] Choose a voice ID (or use default)
- [ ] Add to `.env.local`:
  ```
  ELEVENLABS_API_KEY=sk_xxx
  ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
  ```

## Local Development Setup

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill in all required values from above
- [ ] Generate a secure webhook token (32+ characters)
- [ ] Verify all keys are correct (no extra spaces)

### 2. Install Dependencies
```bash
cd /vercel/share/v0-project
pnpm install
```
- [ ] Dependencies installed successfully
- [ ] No peer dependency warnings

### 3. Verify Type Safety
```bash
pnpm exec tsc --noEmit
```
- [ ] No TypeScript errors

### 4. Start Development Server
```bash
pnpm dev
```
- [ ] Server starts on http://localhost:3000
- [ ] No console errors
- [ ] Home page loads correctly

## Testing

### 1. Verify Home Page
- [ ] Open http://localhost:3000
- [ ] See LinearVoice heading and features
- [ ] Status card is visible

### 2. Test Metrics Endpoint
```bash
curl http://localhost:3000/api/metrics
```
- [ ] Returns JSON with totalEvents and eventTypes
- [ ] No errors in console

### 3. Test Webhook Endpoint
- [ ] Webhook URL is `/api/whatsapp`
- [ ] Ready to receive messages from Kapso
- [ ] Webhook secret is configured

### 4. Configure Kapso Webhook
- [ ] Log into Kapso dashboard
- [ ] Set webhook URL: `https://your-domain.com/api/whatsapp`
- [ ] Set webhook token: (from KAPSO_WEBHOOK_TOKEN)
- [ ] Test webhook connection
- [ ] Verify successful delivery

## First Message Test

### 1. Send Test Message
```bash
curl -X POST http://localhost:3000/api/test/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890", "message": "Hello bot!"}'
```
- [ ] Request succeeds (HTTP 200)
- [ ] No errors in console
- [ ] Message appears to be processed

### 2. Check Metrics
```bash
curl http://localhost:3000/api/metrics
```
- [ ] `totalEvents` has increased
- [ ] `whatsapp.message` count has increased
- [ ] `bot.response` count has increased

## Deployment Preparation

### 1. GitHub Setup (if deploying to Vercel)
- [ ] Repository created on GitHub
- [ ] Code pushed to repository
- [ ] Main branch is default

### 2. Vercel Setup
- [ ] Account created at https://vercel.com
- [ ] Project imported from GitHub
- [ ] Build settings verified (Next.js auto-detected)

### 3. Environment Variables in Vercel
- [ ] In project Settings → Environment Variables
- [ ] Add all variables from `.env.local`:
  - [ ] UPSTASH_REDIS_REST_URL
  - [ ] UPSTASH_REDIS_REST_TOKEN
  - [ ] KAPSO_API_BASE
  - [ ] KAPSO_AUTH_TOKEN
  - [ ] KAPSO_PHONE_ID
  - [ ] KAPSO_WEBHOOK_TOKEN
  - [ ] LINEAR_API_KEY
  - [ ] LINEAR_WORKSPACE_ID
  - [ ] ELEVENLABS_API_KEY (if using voice)
  - [ ] ELEVENLABS_VOICE_ID (if using voice)

### 4. Deploy
- [ ] Trigger deployment from Vercel dashboard
- [ ] Wait for build to complete
- [ ] Verify deployment is successful
- [ ] Test webhook with production URL

### 5. Update Kapso Webhook
- [ ] Change webhook URL to production domain
- [ ] Verify webhook still works with production URL

## Troubleshooting Checklist

If something isn't working:

- [ ] All environment variables are set in `.env.local`
- [ ] No extra whitespace in environment variables
- [ ] Redis instance is active in Upstash console
- [ ] Linear API key is valid (not expired)
- [ ] Kapso auth token is correct
- [ ] Phone number ID matches your Kapso account
- [ ] Development server is running (`pnpm dev`)
- [ ] No conflicting processes on port 3000
- [ ] Check `/dev` logs for error messages
- [ ] Verify external API credentials in their respective consoles

## Next Steps After Setup

1. **Test with Real WhatsApp Messages**
   - [ ] Send message from your WhatsApp to bot number
   - [ ] Receive response back
   - [ ] Check metrics dashboard

2. **Implement Linear Integration**
   - [ ] Follow IMPLEMENTATION.md Step 1
   - [ ] Connect to real Linear API
   - [ ] Test issue creation and search

3. **Add Voice Support**
   - [ ] Follow IMPLEMENTATION.md Step 2
   - [ ] Test voice message handling
   - [ ] Test text-to-speech responses

4. **Build Dashboard**
   - [ ] Follow IMPLEMENTATION.md Step 3
   - [ ] Create metrics dashboard page
   - [ ] Add real-time event stream display

5. **Production Hardening**
   - [ ] Add error tracking (Sentry)
   - [ ] Implement rate limiting
   - [ ] Add message queuing (Upstash Queues)
   - [ ] Set up monitoring and alerts

## Support Resources

- **LinearVoice README**: `./README.md`
- **Implementation Guide**: `./IMPLEMENTATION.md`
- **Environment Template**: `./.env.example`

Good luck! 🚀
