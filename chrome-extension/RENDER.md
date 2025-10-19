# Deploying CTUMP PDF API to Render.com

This guide explains how to deploy the CTUMP PDF API backend server (`ctsample.py`) to Render.com, which is required for the Chrome Extension to work remotely.

## Overview

The CTUMP PDF Chrome Extension requires a backend API server to process PDF conversions. While you can run this locally (`http://localhost:5000`), deploying it to Render.com allows you to:

- Access the API from anywhere
- Share the extension with others without each person running their own server
- Use the extension on any computer without local setup
- Get a permanent HTTPS URL for secure connections
- Benefit from automatic SSL/TLS certificates
- Free tier available with no credit card required

## Prerequisites

Before starting, ensure you have:

1. **A Render.com Account**
   - Sign up at [render.com](https://render.com)
   - Free tier available (no credit card required)
   - GitHub authentication recommended

2. **GitHub Repository Access**
   - Fork or have access to this repository
   - Render deploys directly from GitHub

3. **Basic Understanding**
   - Familiarity with environment variables
   - Understanding of web APIs and HTTPS

## Architecture

```
┌─────────────────┐
│ Chrome Extension│
│   (Your PC)     │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Render Server  │
│  (ctsample.py)  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   CTUMP Server  │
│ media.ctump...  │
└─────────────────┘
```

## Step-by-Step Deployment

### Step 1: Prepare Your Repository

1. **Fork the Repository** (if you haven't already)
   ```bash
   # Go to https://github.com/VitStudio/ctump-pdf
   # Click "Fork" button
   ```

2. **Clone Your Fork** (optional, for local testing)
   ```bash
   git clone https://github.com/YOUR_USERNAME/ctump-pdf.git
   cd ctump-pdf
   ```

### Step 2: Create Render Web Service

1. **Login to Render**
   - Go to [dashboard.render.com](https://dashboard.render.com)
   - Click "Login" or "Get Started" and use GitHub authentication

2. **Create New Web Service**
   - Click "New +" button in the top navigation
   - Select "Web Service"
   - Click "Build and deploy from a Git repository"
   - Click "Next"

3. **Connect Your Repository**
   - If first time, authorize Render to access your GitHub
   - Select your forked `ctump-pdf` repository
   - Click "Connect"

### Step 3: Configure Web Service

On the configuration page, set the following:

1. **Basic Settings**
   - **Name**: `ctump-pdf-api` (or your preferred name)
   - **Region**: Choose closest to your location (e.g., Oregon, Frankfurt, Singapore)
   - **Branch**: `main` (or your working branch)
   - **Root Directory**: Leave blank (app is in root)

2. **Build & Deploy Settings**
   - **Runtime**: `Python 3`
   - **Build Command**: Leave blank (dependencies auto-install)
   - **Start Command**: `python ctsample.py`

3. **Plan Selection**
   - Select **Free** plan
   - Free tier includes:
     - 750 hours/month (enough for continuous running)
     - Automatic SSL/TLS certificates
     - Spins down after 15 minutes of inactivity
     - Restarts on incoming request (cold start ~30 seconds)

4. **Advanced Settings** (Optional)
   - **Auto-Deploy**: Enable (deploys on git push)
   - **Health Check Path**: `/` (optional, for monitoring)

### Step 4: Configure Environment Variables

While Render auto-detects most settings, you may want to configure:

1. **Go to Environment Tab**
   - After creating the service, click "Environment" in the left sidebar

2. **Add Environment Variables** (Optional)
   ```
   PYTHON_VERSION=3.11
   ```

   **Note**: Render automatically sets `PORT` environment variable. The `ctsample.py` file already supports this with `os.environ.get('PORT', 5000)`.

### Step 5: Deploy

1. **Start Deployment**
   - Click "Create Web Service" button
   - Render will start building and deploying automatically

2. **Monitor Build Process**
   - Watch the build logs in real-time
   - Render will:
     - Clone your repository
     - Detect Python runtime
     - Install dependencies (via `_ensure()` function in ctsample.py)
     - Start the application

3. **Wait for Deployment**
   - First deployment takes 3-5 minutes
   - You'll see "Live" status when ready
   - Build logs will show: "Your service is live 🎉"

4. **Get Your URL**
   - Render provides a URL like: `https://ctump-pdf-api.onrender.com`
   - This URL is permanent and uses HTTPS by default
   - Copy this URL for the next step

### Step 6: Test Your Deployment

1. **Test the API URL**
   - Click on your service URL or paste in browser
   - You should see the CTUMP PDF web interface
   - Example: `https://ctump-pdf-api.onrender.com`

2. **Test API Endpoints**
   ```bash
   # Test connection
   curl https://ctump-pdf-api.onrender.com/

   # Test token detection (replace URL with actual viewer URL)
   curl -X POST https://ctump-pdf-api.onrender.com/api/detect-token \
     -H "Content-Type: application/json" \
     -d '{"viewer_url": "https://media.ctump.edu.vn/..."}'
   ```

3. **Check Logs**
   - Go to "Logs" tab in Render dashboard
   - Verify the app started successfully
   - Look for: "CTUMP PDF Tool - Web Interface"

### Step 7: Configure Chrome Extension

1. **Open Extension**
   - Click the CTUMP PDF extension icon in Chrome
   
2. **Update API Server URL**
   - Change from `http://localhost:5000`
   - To your Render URL: `https://ctump-pdf-api.onrender.com`
   - The extension will save this automatically

3. **Test Connection**
   - Click "Test Connection" button
   - Should show "Connected successfully"
   - **Note**: First request may take 30 seconds if service was sleeping

## Understanding Render's Free Tier

### Free Tier Features

- **750 hours/month** of runtime (enough for 24/7 if needed)
- **512 MB RAM** per service
- **Automatic HTTPS** with SSL certificates
- **Automatic deploys** from GitHub
- **Custom domains** supported (optional)
- **Sleep after inactivity**: Service spins down after 15 minutes
- **Cold starts**: 30-60 second restart on first request after sleep

### Free Tier Limitations

1. **Service Sleeps**: After 15 minutes of inactivity
   - First request after sleep takes 30-60 seconds
   - Subsequent requests are fast
   - Not suitable for time-critical applications

2. **No Persistent Disk**: Files don't persist between deploys
   - Use external storage for persistent data
   - Our app uses temporary files only, so this is fine

3. **Build Minutes**: Limited build time per month
   - Usually sufficient for normal use
   - Deploys typically complete in 3-5 minutes

### Tips for Free Tier

1. **Keep Service Awake** (Optional)
   - Use a ping service (e.g., UptimeRobot, Cronitor)
   - Ping your URL every 10 minutes to prevent sleep
   - Free monitoring services available

2. **Accept Cold Starts**
   - First request after sleep is slower
   - Plan for 30-60 second wait time
   - Subsequent requests are fast

3. **Monitor Usage**
   - Check Render dashboard for usage stats
   - Set up email alerts for deployment failures

## Port Configuration

The `ctsample.py` file already supports Render's `PORT` environment variable:

```python
port = int(os.environ.get('PORT', 5000))
app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
```

Render automatically:
- Sets the `PORT` environment variable
- Routes external HTTPS traffic to your app
- Handles SSL/TLS certificates
- Provides load balancing

## Creating a render.yaml (Optional)

For Infrastructure as Code approach, create `render.yaml` in repository root:

```yaml
services:
  - type: web
    name: ctump-pdf-api
    runtime: python
    buildCommand: ""
    startCommand: python ctsample.py
    envVars:
      - key: PYTHON_VERSION
        value: "3.11"
    plan: free
    region: oregon
    healthCheckPath: /
```

Benefits:
- Version control your infrastructure
- Easy to replicate deployments
- Consistent configuration across environments

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 10000 | No (Render sets automatically) |
| `PYTHON_VERSION` | Python version | 3.11 | No (Render detects from runtime) |

## Troubleshooting

### Build Fails

**Problem**: Render build fails with dependency errors

**Solution**:
```bash
# The app auto-installs dependencies via _ensure() function
# If this fails, create requirements.txt in repository root:
httpx[http2]>=0.26
img2pdf>=0.6.0
pikepdf>=9.0
flask>=2.0.0
flask-cors>=3.0.0
```

Then in Render settings, set:
- **Build Command**: `pip install -r requirements.txt`

### Application Won't Start

**Problem**: Build succeeds but app won't start

**Solutions**:
1. Check Render logs for errors: Logs tab → View error messages
2. Verify start command: Settings → `python ctsample.py`
3. Ensure port configuration is correct (should auto-detect)
4. Check that all imports are available

### CORS Errors in Extension

**Problem**: Chrome extension shows CORS errors

**Solution**:
- The `ctsample.py` already includes CORS support via Flask-CORS
- Ensure you're using `https://` URL (not `http://`)
- Render automatically provides HTTPS
- Check Flask-CORS configuration in code:
```python
CORS(app, resources={
    r"/api/*": {
        "origins": ["chrome-extension://*", "https://*"],
        "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})
```

### Slow Initial Request (Cold Start)

**Problem**: First request after inactivity is very slow

**Expected Behavior**:
- This is normal for Render's free tier
- Service spins down after 15 minutes of inactivity
- First request wakes it up (30-60 seconds)
- Subsequent requests are fast

**Solutions**:
1. **Accept it**: Cold starts are part of free tier
2. **Keep alive service**: Use external ping service
   - UptimeRobot (free tier)
   - Cron-job.org
   - Ping every 10 minutes to prevent sleep
3. **Upgrade**: Paid plans don't sleep

### Connection Timeout

**Problem**: Extension can't connect to Render server

**Solutions**:
1. Verify Render URL is correct (check dashboard)
2. Check if Render service is running (should show "Live")
3. Test URL in browser first
4. Wait 30-60 seconds if service was sleeping
5. Check Render status page: [status.render.com](https://status.render.com)

### Extension Not Working After Deploy

**Problem**: Extension worked locally but fails with Render

**Checklist**:
- [ ] Render URL uses HTTPS (automatic with Render)
- [ ] API server is running (check "Live" status)
- [ ] Extension has correct API URL configured
- [ ] CORS is properly configured
- [ ] Test API endpoints in browser/curl first
- [ ] Wait for cold start (30-60 seconds)

### Deployment Failed

**Problem**: Render deployment fails

**Common Causes & Solutions**:

1. **Python Version Issues**
   - Render auto-detects Python version
   - Can specify with `runtime.txt`: `python-3.11`

2. **Dependency Installation Fails**
   - Check build logs for specific error
   - May need to create `requirements.txt`

3. **Port Binding Issues**
   - Ensure app uses `0.0.0.0` host (already configured)
   - Verify `PORT` environment variable support (already configured)

4. **Memory Exceeded**
   - Free tier has 512 MB limit
   - Our app is lightweight, shouldn't hit this
   - Check for memory leaks in logs

## Advanced Configuration

### Custom Domain

1. **Add Domain in Render**
   - Go to Settings → Custom Domains
   - Click "Add Custom Domain"
   - Follow Render's domain setup instructions
   - Add DNS records as instructed

2. **Update Extension**
   - Use custom domain in extension settings
   - Example: `https://api.yourapp.com`

### Health Checks

Render can monitor your app health:

1. **Configure Health Check**
   - Settings → Health Check Path: `/`
   - Render pings this endpoint
   - Service restarts if unhealthy

2. **Custom Health Endpoint** (Optional)
   - Add `/health` endpoint to ctsample.py
   - Returns 200 OK if healthy
   - More reliable than homepage

### Environment-Based Configuration

For different environments (dev/prod):

```python
import os

# In ctsample.py
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
```

Set in Render:
- Environment → Add Variable
- Key: `DEBUG`, Value: `False`
- Key: `LOG_LEVEL`, Value: `INFO`

### Monitoring and Logs

1. **View Logs**
   - Render dashboard → Logs tab
   - Real-time log streaming
   - Filter by time range

2. **Set Up Alerts**
   - Settings → Notifications
   - Email alerts for deploy failures
   - Service health alerts

3. **External Monitoring**
   - Use UptimeRobot for uptime monitoring
   - Cronitor for scheduled jobs
   - Datadog/New Relic for APM (paid)

### Scaling

Render offers paid plans with:
- **Starter ($7/month)**: 
  - No sleep
  - 512 MB RAM
  - Better for production
  
- **Standard ($25/month)**:
  - 2 GB RAM
  - Horizontal scaling
  - Advanced features

For this use case, free tier is usually sufficient.

## Render vs Railway vs Heroku

| Feature | Render Free | Railway Free | Heroku Free |
|---------|-------------|--------------|-------------|
| **Cost** | Free | $5 credit/month | Discontinued |
| **Sleep** | After 15 min | No automatic sleep | N/A |
| **RAM** | 512 MB | 512 MB | N/A |
| **Build Time** | ~3-5 min | ~2-3 min | N/A |
| **HTTPS** | ✅ Auto | ✅ Auto | N/A |
| **Custom Domain** | ✅ Free | ✅ Paid | N/A |
| **GitHub Deploy** | ✅ | ✅ | N/A |
| **Cold Start** | 30-60s | N/A | N/A |

**Note**: Heroku discontinued free tier in November 2022.

## Security Best Practices

1. **Use HTTPS Only**
   - Render provides HTTPS by default
   - Never use HTTP for production

2. **Environment Variables**
   - Don't commit secrets to git
   - Use Render's environment variables
   - Rotate sensitive values regularly

3. **CORS Configuration**
   - Keep CORS settings restrictive
   - Only allow necessary origins
   - Already configured in ctsample.py

4. **Access Control** (Optional)
   - Add API key authentication
   - Rate limiting with Flask-Limiter
   - IP whitelisting in Render

5. **Keep Dependencies Updated**
   - Regularly update Python packages
   - Monitor security advisories
   - Render shows outdated dependencies

## Maintenance

### Updating Your Deployment

1. **Push Changes to GitHub**
   ```bash
   git add .
   git commit -m "Update app"
   git push origin main
   ```

2. **Render Auto-Deploys**
   - Render automatically detects push
   - Starts new deployment
   - Zero-downtime deployment (for paid plans)
   - Watch progress in dashboard

3. **Manual Deploy**
   - Dashboard → Manual Deploy
   - Click "Clear build cache & deploy"
   - Useful for troubleshooting

### Rolling Back

If deployment fails or has issues:

1. **View Deployment History**
   - Dashboard → Deploys tab
   - See all previous deployments

2. **Rollback to Previous Version**
   - Click on successful deployment
   - Click "Redeploy"
   - Instant rollback to that version

3. **From Git**
   ```bash
   git revert HEAD
   git push origin main
   # Render auto-deploys the revert
   ```

### Suspending Service

To save hours or pause service:

1. Dashboard → Settings
2. Scroll to "Suspend Service"
3. Click "Suspend"
4. Resume anytime with "Resume Service"

## Comparison with Other Platforms

### When to Choose Render

**Pros**:
- ✅ No credit card required for free tier
- ✅ Simple, intuitive interface
- ✅ Automatic HTTPS
- ✅ Good documentation
- ✅ Infrastructure as Code (render.yaml)
- ✅ Generous free tier (750 hours)

**Cons**:
- ❌ Cold starts on free tier (15 min sleep)
- ❌ Limited to 512 MB RAM on free tier
- ❌ Slower deploys than some competitors

### Alternatives

1. **Railway**
   - Faster deploys
   - No automatic sleep
   - Requires $5 credit/month

2. **Fly.io**
   - Edge deployment
   - More complex setup
   - Good free tier

3. **DigitalOcean App Platform**
   - Fixed pricing ($5/month minimum)
   - No free tier
   - Good for production

4. **Google Cloud Run**
   - Pay per use
   - Complex setup
   - Generous free tier
   - Best for sporadic use

## Getting Help

If you encounter issues:

1. **Check Render Status**
   - [status.render.com](https://status.render.com)
   - Check for ongoing incidents

2. **Render Documentation**
   - [render.com/docs](https://render.com/docs)
   - Comprehensive guides and tutorials

3. **Render Community**
   - [community.render.com](https://community.render.com)
   - Active community forum
   - Render staff respond quickly

4. **Repository Issues**
   - Open issue on GitHub with:
     - Render build/deploy logs
     - Error messages
     - Steps to reproduce

5. **Render Support**
   - Email: support@render.com
   - Response time: Usually 24-48 hours
   - Faster for paid plans

## Complete Deployment Checklist

- [ ] Create Render account (free, no credit card)
- [ ] Fork/have access to repository
- [ ] Create new Web Service in Render
- [ ] Connect GitHub repository
- [ ] Configure service settings:
  - [ ] Name: `ctump-pdf-api`
  - [ ] Runtime: Python 3
  - [ ] Start Command: `python ctsample.py`
  - [ ] Plan: Free
- [ ] Deploy and wait for "Live" status
- [ ] Get your Render URL (https://your-app.onrender.com)
- [ ] Test API in browser
- [ ] Configure Chrome extension with Render URL
- [ ] Test connection (wait for cold start if needed)
- [ ] Test extension functionality
- [ ] (Optional) Set up uptime monitoring to prevent sleep
- [ ] Monitor logs and deployment status

## Summary

Deploying to Render makes your CTUMP PDF extension accessible from anywhere:

1. **Render** provides the hosting infrastructure with automatic HTTPS
2. **ctsample.py** runs as the API backend
3. **Chrome Extension** connects to your Render URL
4. **Free tier** is generous and requires no credit card

The entire process takes about 10-15 minutes:
- 2 minutes: Create account and connect repository
- 3-5 minutes: First deployment
- 2 minutes: Configure extension and test
- 1-2 minutes: Verify functionality

**Key Advantages of Render**:
- No credit card required for free tier
- Automatic HTTPS with SSL certificates
- Simple, intuitive interface
- Good for learning and personal projects

**Main Consideration**:
- Free tier sleeps after 15 minutes (30-60 second cold start)
- Can use external ping service to keep awake
- Or upgrade to paid plan ($7/month) for no sleep

---

**Need Help?** Open an issue on GitHub or check Render's documentation for platform-specific questions.

**Note**: This deployment is for personal or educational use. Ensure compliance with CTUMP university policies when using this tool.
