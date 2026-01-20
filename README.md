<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Spanish Verbs - AI-Powered Conjugation App

A React application for learning Spanish verb conjugations, powered by Google's Gemini AI.

View your app in AI Studio: https://ai.studio/apps/drive/1mE9o8cbootDMmpb1IW-XzpuwuXb-hFJF

## 🚀 Deployment

This application is ready to be deployed to GitHub Pages with automated deployment via GitHub Actions.

**📖 [View Deployment Guide](DEPLOYMENT.md)** - Complete instructions for deploying to GitHub Pages

Once deployed, your app will be available at: **https://bigmax8808.github.io/Spanish-Verbs/**

## 🛠️ Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser

## 📦 Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.
