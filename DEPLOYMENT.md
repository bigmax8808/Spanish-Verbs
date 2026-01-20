# Deployment Guide

This guide explains how to deploy the Spanish Verbs application to GitHub Pages.

## Prerequisites

- Repository pushed to GitHub
- GitHub Actions enabled for the repository
- Node.js 20+ installed for local development

## Automated Deployment Setup

The repository is configured for automatic deployment to GitHub Pages using GitHub Actions. Follow these steps to enable deployment:

### Step 1: Enable GitHub Pages

**Option A: If GitHub Actions is NOT yet selected:**
1. Go to your repository on GitHub: https://github.com/bigmax8808/Spanish-Verbs
2. Click on **Settings** (in the repository menu)
3. In the left sidebar, click on **Pages** (under "Code and automation")
4. Under **Source**, select **GitHub Actions** from the dropdown menu
5. Click **Save**

**Option B: If GitHub Actions is already selected (greyed out):**

If you see "GitHub Actions" already selected and greyed out with no Save button, this is actually CORRECT! The greyed-out state means GitHub Pages is already configured to use GitHub Actions for deployment.

The issue is likely that the workflow needs proper permissions or a manual trigger. Continue to Step 2 to verify permissions, then manually trigger the workflow in Step 3.

### Step 2: Verify Workflow Permissions

1. In the repository settings, go to **Actions** → **General** (in the left sidebar)
2. Scroll down to **Workflow permissions**
3. Ensure that **Read and write permissions** is selected
4. Check the box for **Allow GitHub Actions to create and approve pull requests**
5. Click **Save**

### Step 3: Trigger Deployment

The deployment will automatically trigger when you:
- Push to the `main` branch
- Manually trigger the workflow from the Actions tab

To manually trigger:
1. Go to the **Actions** tab in your repository
2. Select **Build and deploy to GitHub Pages** workflow
3. Click **Run workflow**
4. Select the `main` branch
5. Click **Run workflow**

## Deployment Workflow

The `.github/workflows/deploy-pages.yml` file automates the following steps:

1. **Checkout** - Fetches the repository code
2. **Setup Node.js** - Installs Node.js 20
3. **Install Dependencies** - Runs `npm ci` to install packages
4. **Build** - Runs `npm run build` to create production build in `./dist`
5. **Upload Artifact** - Packages the build for GitHub Pages
6. **Deploy** - Deploys to GitHub Pages

## Accessing Your Deployed Application

Once deployment is successful, your application will be available at:

**https://bigmax8808.github.io/Spanish-Verbs/**

## Troubleshooting

### GitHub Actions is Greyed Out with No Save Button

**Symptoms:**
- You go to Settings → Pages
- "GitHub Actions" is already selected (checked)
- The option is greyed out
- There's no Save button visible
- Site still shows 404 error

**This is actually NORMAL!** The greyed-out state means GitHub Pages is properly configured to use GitHub Actions. The 404 error occurs because the workflow hasn't run successfully yet. Here's how to fix it:

**Solution Steps:**

1. **Verify Workflow Permissions:**
   - Go to Settings → Actions → General
   - Under "Workflow permissions", select **Read and write permissions**
   - Check **Allow GitHub Actions to create and approve pull requests**
   - Click **Save**

2. **Manually Trigger the Workflow:**
   
   **Finding the Workflow:**
   - Go to your repository: https://github.com/bigmax8808/Spanish-Verbs
   - Click the **Actions** tab (between Pull requests and Projects)
   - On the left sidebar, you'll see "All workflows"
   - Look for one of these names:
     * **"Build and deploy to GitHub Pages"** (the display name)
     * **".github/workflows/deploy-pages.yml"** (the file name)
   - Click on it
   
   **If you don't see any workflows:**
   - The workflow file might only exist on the PR branch
   - Go to: https://github.com/bigmax8808/Spanish-Verbs/actions/workflows/deploy-pages.yml
   - This direct link should show the workflow
   
   **Triggering the Workflow:**
   - Once on the workflow page, click **Run workflow** button (top right, blue button)
   - A dropdown will appear
   - Select `copilot/deploy-application` branch (or `main` if this PR is merged)
   - Click the green **Run workflow** button in the dropdown
   - Wait 2-3 minutes for it to complete

3. **Check Workflow Status:**
   - Stay on the Actions tab
   - You should see a yellow dot (running) that turns green (success) or red (failed)
   - If it turns green, wait a few more minutes and check https://bigmax8808.github.io/Spanish-Verbs/
   - If it turns red, click on the failed run to see error details

4. **If Workflow Doesn't Start:**
   - The workflow might be disabled
   - Go to Actions tab → Click on "Build and deploy to GitHub Pages"
   - If you see an "Enable workflow" button, click it
   - Then try triggering it again (Step 2)

### Deployment Fails with 404 Error

**Error Message:**
```
Error: Failed to create deployment (status: 404). Ensure GitHub Pages has been enabled
```

**Solution:**
- Ensure GitHub Pages is enabled in repository settings (see Step 1 above)
- Verify that the source is set to "GitHub Actions"

### Build Fails with Node Version Error

**Error Message:**
```
npm warn EBADENGINE Unsupported engine
```

**Solution:**
- Update the Node.js version in `.github/workflows/deploy-pages.yml` to Node.js 20:
  ```yaml
  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: '20'
  ```

### Assets Not Loading (404 on CSS/JS files)

**Error:** 
Files load correctly locally but return 404 when deployed

**Solution:**
- Ensure the `base` path in `vite.config.ts` matches your repository name:
  ```typescript
  base: '/Spanish-Verbs/',
  ```

### Workflow Permission Errors

**Error Message:**
```
Error: Resource not accessible by integration
```

**Solution:**
- Check workflow permissions in Settings → Actions → General
- Enable "Read and write permissions"

## Quick Links

For faster access, use these direct links:

- **Workflow File:** https://github.com/bigmax8808/Spanish-Verbs/actions/workflows/deploy-pages.yml
- **Repository Actions:** https://github.com/bigmax8808/Spanish-Verbs/actions
- **Repository Settings:** https://github.com/bigmax8808/Spanish-Verbs/settings
- **Pages Settings:** https://github.com/bigmax8808/Spanish-Verbs/settings/pages
- **Actions Settings:** https://github.com/bigmax8808/Spanish-Verbs/settings/actions
- **Deployed Site:** https://bigmax8808.github.io/Spanish-Verbs/ (after successful deployment)

## Local Development

To run the application locally:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

## Environment Variables

The application uses the Gemini API. For local development:

1. Create a `.env.local` file in the project root
2. Add your API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

**Note:** API keys are not needed for deployment as they should be configured at build time or runtime as appropriate for your use case.

## Workflow File Location

The deployment configuration is located at:
```
.github/workflows/deploy-pages.yml
```

## Support

For issues related to:
- **GitHub Pages:** See [GitHub Pages documentation](https://docs.github.com/en/pages)
- **GitHub Actions:** See [GitHub Actions documentation](https://docs.github.com/en/actions)
- **Vite Build:** See [Vite documentation](https://vite.dev/)
