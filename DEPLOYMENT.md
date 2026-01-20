# Deployment Guide

This guide explains how to deploy the Spanish Verbs application to GitHub Pages.

## Prerequisites

- Repository pushed to GitHub
- GitHub Actions enabled for the repository
- Node.js 20+ installed for local development

## Automated Deployment Setup

The repository is configured for automatic deployment to GitHub Pages using GitHub Actions. Follow these steps to enable deployment:

### Step 1: Enable GitHub Pages

1. Go to your repository on GitHub: https://github.com/bigmax8808/Spanish-Verbs
2. Click on **Settings** (in the repository menu)
3. In the left sidebar, click on **Pages** (under "Code and automation")
4. Under **Source**, select **GitHub Actions** from the dropdown menu
5. Click **Save**

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
2. **Setup Node.js** - Installs Node.js 18
3. **Install Dependencies** - Runs `npm ci` to install packages
4. **Build** - Runs `npm run build` to create production build in `./dist`
5. **Upload Artifact** - Packages the build for GitHub Pages
6. **Deploy** - Deploys to GitHub Pages

## Accessing Your Deployed Application

Once deployment is successful, your application will be available at:

**https://bigmax8808.github.io/Spanish-Verbs/**

## Troubleshooting

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
