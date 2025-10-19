# Deploying CTUMP PDF API to Railway

This guide explains how to deploy the CTUMP PDF API backend server (`ctsample.py`) to Railway, which is required for the Chrome Extension to work remotely.

## Overview

The CTUMP PDF Chrome Extension requires a backend API server to process PDF conversions. While you can run this locally (`http://localhost:5000`), deploying it to Railway allows you to:

- Access the API from anywhere
- Share the extension with others without each person running their own server
- Use the extension on any computer without local setup
- Get a permanent HTTPS URL for secure connections

## Prerequisites

Before starting, ensure you have:

1. **A Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Free tier available with generous limits
   - GitHub authentication recommended

2. **GitHub Repository Access**
   - Fork or have access to this repository
   - Railway deploys directly from GitHub

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
│  Railway Server │
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

### Step 2: Create Railway Project

1. **Login to Railway**
   - Go to [railway.app](https://railway.app)
   - Click "Login" and use GitHub authentication

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your forked repository
   - Railway will automatically detect it's a Python project

3. **Configure Root Directory** (Important!)
   - Railway needs to know which directory contains the app
   - In Railway dashboard, go to Settings
   - Leave the root directory as `/` (the main app is in the root)

### Step 3: Configure Environment Variables

Railway needs to know how to run your application. Add these settings:

1. **Go to Variables Tab**
   - Click on your service
   - Navigate to "Variables" tab

2. **Add Environment Variables** (if needed)
   ```
   PYTHON_VERSION=3.11
   PORT=5000
   ```

   Note: Railway automatically sets `PORT` environment variable, but our app uses 5000 by default.

### Step 4: Configure Start Command

Railway needs to know how to start your app:

1. **Go to Settings Tab**
   - Click on your service
   - Navigate to "Settings" section

2. **Set Start Command**
   ```bash
   python ctsample.py
   ```

   Or create a `Procfile` in the repository root:
   ```
   web: python ctsample.py
   ```

### Step 5: Deploy

1. **Trigger Deployment**
   - Railway automatically deploys on push to the connected branch
   - Or click "Deploy" button in Railway dashboard
   - Watch the build logs to ensure successful deployment

2. **Wait for Deployment**
   - Deployment usually takes 2-5 minutes
   - Railway will install dependencies automatically
   - Watch for "Build successful" and "Deployment live"

3. **Get Your URL**
   - Once deployed, Railway provides a URL like:
   - `https://your-app-name.up.railway.app`
   - Click "Settings" → "Generate Domain" if you don't have one

### Step 6: Test Your Deployment

1. **Test the API URL**
   - Open your Railway URL in a browser
   - You should see the CTUMP PDF web interface
   - Example: `https://your-app-name.up.railway.app`

2. **Test API Endpoints**
   ```bash
   # Test connection
   curl https://your-app-name.up.railway.app/

   # Test token detection (replace URL with actual viewer URL)
   curl -X POST https://your-app-name.up.railway.app/api/detect-token \
     -H "Content-Type: application/json" \
     -d '{"viewer_url": "https://media.ctump.edu.vn/..."}'
   ```

### Step 7: Configure Chrome Extension

1. **Open Extension**
   - Click the CTUMP PDF extension icon in Chrome
   
2. **Update API Server URL**
   - Change from `http://localhost:5000`
   - To your Railway URL: `https://your-app-name.up.railway.app`
   - The extension will save this automatically

3. **Test Connection**
   - Click "Test Connection" button
   - Should show "Connected successfully"

## Port Configuration

The `ctsample.py` file runs on port 5000 by default. Railway expects apps to use the `PORT` environment variable. You have two options:

### Option 1: Modify ctsample.py (Recommended)

Update the last line of `ctsample.py`:

```python
if __name__ == "__main__":
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
```

### Option 2: Use Railway's PORT Environment Variable

Railway automatically provides `$PORT`, so you can set:
- Variable: `PORT`
- Value: `5000`

## Creating Essential Railway Files

### 1. Create `Procfile`

Create a file named `Procfile` in the repository root:

```
web: python ctsample.py
```

### 2. Create `runtime.txt` (Optional)

Specify Python version in `runtime.txt`:

```
python-3.11
```

### 3. Create `.railwayignore` (Optional)

Similar to `.gitignore`, exclude unnecessary files:

```
__pycache__/
*.pyc
.git/
.vscode/
*.log
chrome-extension/
ct_gui.py
```

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 5000 | No (Railway sets automatically) |
| `PYTHON_VERSION` | Python version | 3.11 | No |

## Cost and Usage

### Railway Free Tier

- **$5 free credit** per month
- **500 hours** of usage
- **100 GB** of bandwidth
- **1 GB** of memory per service
- Sufficient for moderate use

### Tips to Reduce Costs

1. **Stop When Not Using**
   - Pause deployment when not needed
   - Railway → Settings → "Sleep after inactivity"

2. **Monitor Usage**
   - Check Railway dashboard regularly
   - Set up usage alerts

3. **Optimize Requests**
   - Cache results when possible
   - Batch process documents

## Troubleshooting

### Build Fails

**Problem**: Railway build fails with dependency errors

**Solution**:
```bash
# The app auto-installs dependencies via _ensure() function
# If this fails, create requirements.txt:
httpx[http2]>=0.26
img2pdf>=0.6.0
pikepdf>=9.0
flask>=2.0.0
flask-cors>=3.0.0
```

### Application Won't Start

**Problem**: Build succeeds but app won't start

**Solutions**:
1. Check Railway logs for errors
2. Verify `Procfile` has correct start command
3. Ensure port configuration is correct
4. Check that all imports are available

### CORS Errors in Extension

**Problem**: Chrome extension shows CORS errors

**Solution**:
- The `ctsample.py` already includes CORS support
- Ensure you're using `https://` URL (not `http://`)
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

### Connection Timeout

**Problem**: Extension can't connect to Railway server

**Solutions**:
1. Verify Railway URL is correct
2. Check if Railway service is running
3. Test URL in browser first
4. Ensure Railway hasn't gone to sleep (cold start takes 10-30 seconds)

### Extension Not Working After Deploy

**Problem**: Extension worked locally but fails with Railway

**Checklist**:
- [ ] Railway URL uses HTTPS (required for extensions)
- [ ] API server is running (check Railway logs)
- [ ] Extension has correct API URL configured
- [ ] CORS is properly configured
- [ ] Test API endpoints in browser/curl first

## Advanced Configuration

### Custom Domain

1. **Add Domain in Railway**
   - Settings → Domains
   - Click "Add Domain"
   - Follow Railway's domain setup instructions

2. **Update Extension**
   - Use custom domain in extension settings
   - Example: `https://api.yourapp.com`

### Environment-Based Configuration

For different environments (dev/prod), use Railway's environment variables:

```python
import os

# In ctsample.py
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
```

### Monitoring and Logs

1. **View Logs**
   - Railway dashboard → Deployments → View Logs
   - Real-time log streaming available

2. **Set Up Alerts**
   - Railway → Settings → Notifications
   - Email alerts for deployment failures

### Scaling

Railway automatically scales within your plan limits:

- **Vertical Scaling**: Increase memory/CPU in Settings
- **Horizontal Scaling**: Not needed for this use case

## Security Best Practices

1. **Use HTTPS Only**
   - Railway provides HTTPS by default
   - Never use HTTP for production

2. **Environment Variables**
   - Don't commit secrets to git
   - Use Railway's environment variables

3. **Rate Limiting**
   - Consider adding rate limiting for public deployments
   - Use Flask-Limiter if needed

4. **CORS Configuration**
   - Keep CORS settings restrictive
   - Only allow necessary origins

## Maintenance

### Updating Your Deployment

1. **Push Changes to GitHub**
   ```bash
   git add .
   git commit -m "Update app"
   git push origin main
   ```

2. **Railway Auto-Deploys**
   - Railway automatically deploys new commits
   - Watch deployment progress in dashboard

### Rolling Back

If deployment fails:

1. Go to Railway dashboard
2. Deployments → Select previous working deployment
3. Click "Redeploy"

## Alternative Deployment Platforms

If Railway doesn't work for you, consider:

1. **Heroku** - Similar to Railway, easy deployment
2. **Render** - Free tier available, auto-deploy from git
3. **Fly.io** - Good free tier, edge deployment
4. **DigitalOcean App Platform** - Simple deployment, fixed pricing
5. **Google Cloud Run** - Pay per use, good for sporadic use

All these platforms support Python Flask apps and can run `ctsample.py`.

## Getting Help

If you encounter issues:

1. **Check Railway Status**
   - [status.railway.app](https://status.railway.app)

2. **Railway Documentation**
   - [docs.railway.app](https://docs.railway.app)

3. **Repository Issues**
   - Open issue on GitHub with:
     - Railway logs
     - Error messages
     - Steps to reproduce

4. **Railway Community**
   - [Railway Discord](https://discord.gg/railway)
   - Active community support

## Complete Deployment Checklist

- [ ] Fork/clone the repository
- [ ] Create Railway account
- [ ] Create new Railway project from GitHub
- [ ] Configure start command: `python ctsample.py`
- [ ] Add PORT environment variable (if needed)
- [ ] Deploy and wait for success
- [ ] Get your Railway URL
- [ ] Test API in browser
- [ ] Configure Chrome extension with Railway URL
- [ ] Test extension functionality
- [ ] Monitor usage and logs

## Summary

Deploying to Railway makes your CTUMP PDF extension accessible from anywhere:

1. **Railway** provides the hosting infrastructure
2. **ctsample.py** runs as the API backend
3. **Chrome Extension** connects to your Railway URL
4. **HTTPS** ensures secure connections

The entire process takes about 10-15 minutes and requires minimal configuration thanks to Railway's automatic detection and the app's self-installing dependencies.

---

**Need Help?** Open an issue on GitHub or check Railway's documentation for platform-specific questions.

**Note**: This deployment is for personal or educational use. Ensure compliance with CTUMP university policies when using this tool.
