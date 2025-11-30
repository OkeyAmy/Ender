# Ender

**Democratizing Blockchain Development with AI**

> **Ender** democratizes blockchain development by allowing anyone to build sophisticated decentralized applications (dapps) simply by describing them. By combining advanced AI code generation with robust web scraping capabilities, Ender turns natural language into deployed, functional dapps on Solana and Celo in minutes, not months.

![Ender Banner](public/og-image.png)

## 🚀 Overview

Ender is a production-ready platform that bridges the gap between natural language and blockchain deployment. Built on the powerful **Open Lovable** engine, Ender empowers developers and non-developers alike to create complex, production-grade dapps without writing boilerplate code.

Whether you need a DeFi dashboard, an NFT marketplace, or a DAO governance portal, Ender understands your intent, scrapes necessary context from the web, and generates secure, optimized code tailored for the **Solana** and **Celo** ecosystems.

## ✨ Key Features

### 🧠 AI-Powered Dapp Generation
Leveraging state-of-the-art AI models (including Claude 3.5 Sonnet, GPT-4o, and Gemini), Ender translates natural language into full-stack blockchain applications. It handles:
- Smart contract integration
- Frontend UI/UX design with Tailwind CSS
- Wallet connection and state management

### 🕸️ Open Lovable Scraping Engine
Ender uses the **Open Lovable** scraping technology to gather real-time data and context for your applications. This enables you to:
- Clone and adapt existing UI patterns
- Ingest documentation for new protocols instantly
- Pull specific web content to inform your dapp's logic

### 🛡️ Secure Sandboxed Environment
All code generation and execution happen within a secure, isolated sandbox environment. This ensures:
- **Safety:** Malicious code cannot affect your host system.
- **Reproducibility:** Consistent builds every time.
- **Real-time Preview:** See your dapp come to life instantly as the AI builds it.

### ⛓️ Multi-Chain Support
Ender is optimized for high-performance blockchains:
- **Solana:** Build ultra-fast, low-fee dapps.
- **Celo:** Create mobile-first, carbon-negative financial applications.

### 🧰 Developer Ergonomics
- Next.js 15 + TypeScript + Tailwind CSS front-end
- AI orchestration through the Open Lovable engine
- Built-in sandboxing via Vercel Sandbox or E2B
- Ready-to-use integrations for Solana Web3.js and the Celo SDK

## 🏗️ Architecture

Ender is built on a modern, scalable stack:

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **AI Orchestration:** Open Lovable Engine (Python/Node.js hybrid)
- **Sandboxing:** Vercel Sandbox / E2B
- **Blockchain Integration:** Solana Web3.js, Celo SDK

## 🛠️ Getting Started

Follow these steps to set up Ender locally.

### Prerequisites
- Node.js 18+
- pnpm, npm, or yarn
- API keys for required services (see [Environment Variables](#environment-variables))

### Installation

1. **Clone & Install**
   ```bash
   git clone https://github.com/your-org/ender.git
   cd ender
   pnpm install  # or npm install / yarn install
   ```

2. **Configure Environment Variables**

   Copy the `.env.example` file to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` and add your API keys. See the [Environment Variables](#environment-variables) section below for detailed recommendations.

   **Quick Start (Minimum Required):**
   - At least one web scraper API key (`FIRECRAWL_API_KEY` recommended)
   - At least one AI provider API key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `GROQ_API_KEY`)
   - Sandbox provider configuration (Vercel or E2B)

3. **Run the Application**
   ```bash
   pnpm dev  # or npm run dev / yarn dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage

1. **Describe your Dapp:** Enter a prompt like "Create a staking dashboard for Celo that allows users to deposit cUSD and earn rewards."
2. **Refine with Context:** Optionally provide URLs to existing dapps or documentation for Ender to analyze using the Open Lovable scraper.
3. **Iterate:** Watch as Ender builds your app in real-time. Chat with the AI to refine the design, add features, or fix bugs.
4. **Deploy:** Once satisfied, export your code or deploy directly to the blockchain.

## 🧩 Project Structure
- `app/`: Next.js App Router pages and API routes
- `components/`, `atoms/`: Shared UI components
- `lib/`, `utils/`: Core helpers, SDK utilities, and AI orchestration logic
- `public/`: Static assets (including the Open Graph banner)
- `styles/`, `tailwind.config.ts`: Styling configuration

## 📦 Scripts
- `pnpm dev` — Start the local development server
- `pnpm lint` — Run linting
- `pnpm test` — Run automated tests (if configured)
- `pnpm build` — Create a production build

## 🌐 Environment Variables

### Required Variables

#### Web Scraping (At least one required)

**FIRECRAWL_API_KEY** (Recommended)
- **Required**: Yes (at least one scraper)
- **Recommended**: Yes - Default and most reliable option
- **Description**: API key for Firecrawl web scraping service
- **Get it**: [https://firecrawl.dev](https://firecrawl.dev)
- **Use case**: Fast and reliable web scraping with caching, screenshot capture support
- **Performance**: Fast response times, built-in caching reduces API calls

**SCRAPEGRAPH_API_KEY** (Optional Alternative)
- **Required**: No (but recommended as backup)
- **Recommended**: Yes - Good alternative if Firecrawl has issues
- **Description**: API key for ScrapeGraph AI web scraping service
- **Get it**: [https://scrapegraphai.com](https://scrapegraphai.com)
- **Use case**: AI-powered intelligent web scraping with advanced content extraction
- **Performance**: Better for complex pages, may be slower than Firecrawl

#### AI Provider (At least one required)

**ANTHROPIC_API_KEY** (Recommended)
- **Required**: Yes (at least one AI provider)
- **Recommended**: Yes - Best quality for code generation
- **Description**: API key for Anthropic Claude models
- **Get it**: [https://console.anthropic.com](https://console.anthropic.com)
- **Use case**: High-quality code generation, best reasoning capabilities
- **Performance**: Slower but highest quality output

**OPENAI_API_KEY**
- **Required**: Yes (at least one AI provider)
- **Recommended**: Yes - Good balance of speed and quality
- **Description**: API key for OpenAI GPT models
- **Get it**: [https://platform.openai.com](https://platform.openai.com)
- **Use case**: Fast code generation with good quality
- **Performance**: Fast response times, good quality

**GEMINI_API_KEY**
- **Required**: Yes (at least one AI provider)
- **Recommended**: Optional - Good for experimentation
- **Description**: API key for Google Gemini models
- **Get it**: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **Use case**: Alternative AI provider, experimental features
- **Performance**: Fast, good for simple tasks

**GROQ_API_KEY**
- **Required**: Yes (at least one AI provider)
- **Recommended**: Yes - Fastest option
- **Description**: API key for Groq API (supports multiple models)
- **Get it**: [https://console.groq.com](https://console.groq.com)
- **Use case**: Ultra-fast inference, good for rapid iterations
- **Performance**: Fastest response times, cost-effective

#### Sandbox Provider (Required - Choose one)

**SANDBOX_PROVIDER**
- **Required**: Yes
- **Recommended**: `vercel` for most users, `e2b` for advanced use cases
- **Description**: Choose your sandbox execution environment
- **Options**: `vercel` (default) or `e2b`
- **Use case**:
  - `vercel`: Better integration, easier setup, recommended for most users
  - `e2b`: More control, longer timeout (30min vs 15min), better for complex builds

**Vercel Sandbox Authentication** (Required if SANDBOX_PROVIDER=vercel)

Choose ONE authentication method:

**VERCEL_OIDC_TOKEN** (Recommended for development)
- **Required**: Yes (if using Vercel sandbox and Method A)
- **Recommended**: Yes - Easiest setup
- **Description**: OIDC token automatically generated by Vercel CLI
- **Get it**: Run `vercel link` then `vercel env pull` in your project
- **Use case**: Development environments, automatic token management
- **Performance**: No manual token management needed

**VERCEL_TOKEN** + **VERCEL_TEAM_ID** + **VERCEL_PROJECT_ID** (Alternative)
- **Required**: Yes (if using Vercel sandbox and Method B)
- **Recommended**: For production deployments
- **Description**: Personal access token with team and project IDs
- **Get it**:
  - Token: [Vercel Dashboard → Settings → Tokens](https://vercel.com/account/tokens)
  - Team ID: Found in team settings URL or API
  - Project ID: Found in project settings
- **Use case**: Production environments, CI/CD pipelines
- **Performance**: More control, better for automated deployments

**E2B Sandbox** (Required if SANDBOX_PROVIDER=e2b)

**E2B_API_KEY**
- **Required**: Yes (if using E2B sandbox)
- **Recommended**: For advanced users needing longer timeouts
- **Description**: API key for E2B sandbox environment
- **Get it**: [https://e2b.dev](https://e2b.dev)
- **Use case**: Longer-running builds, more control over environment
- **Performance**: 30-minute timeout vs 15 minutes for Vercel

### Optional Variables

#### Performance & Features

**MORPH_API_KEY**
- **Required**: No
- **Recommended**: Yes - Significantly speeds up code edits
- **Description**: API key for Morph LLM fast apply feature
- **Get it**: [https://morphllm.com/dashboard](https://morphllm.com/dashboard)
- **Use case**: Faster code application for edits (not initial generation)
- **Performance**: Can reduce edit time by 50-70%
- **Note**: Only used for edits, not initial code generation

**AI_GATEWAY_API_KEY**
- **Required**: No
- **Recommended**: For production deployments using Vercel
- **Description**: Vercel AI Gateway API key (unified API for multiple providers)
- **Get it**: [Vercel AI Gateway](https://vercel.com/docs/ai/ai-gateway)
- **Use case**: Unified API access, rate limiting, caching, analytics
- **Performance**: Better rate limiting and caching, single API key for all providers
- **Note**: When set, overrides individual provider API keys

**NEXT_PUBLIC_APP_URL**
- **Required**: No
- **Recommended**: Yes - Required for production deployments
- **Description**: Base URL for internal API calls
- **Default**: `http://localhost:3000`
- **Use case**: Production deployments, custom domains
- **Example**: `https://your-domain.com` or `https://your-app.vercel.app`
- **Performance**: Ensures correct API routing in production

#### Development & Debugging

**DEBUG**
- **Required**: No
- **Recommended**: For troubleshooting
- **Description**: Enable debug logging
- **Default**: Not set (no debug logs)
- **Use case**: Troubleshooting issues, development debugging
- **Example**: Set to any value to enable (e.g., `DEBUG=true`)

**NPM_FLAGS**
- **Required**: No
- **Recommended**: Yes - Helps with package installation issues
- **Description**: Additional flags for npm install commands
- **Default**: Empty string
- **Use case**: Handle peer dependency conflicts
- **Example**: `--legacy-peer-deps` or `--force`
- **Performance**: Can resolve package installation issues

**AUTO_RESTART_VITE**
- **Required**: No
- **Recommended**: Yes - Improves development experience
- **Description**: Automatically restart Vite dev server after package installation
- **Default**: Not set (manual restart required)
- **Use case**: Automatic dev server refresh after installing packages

## 🤝 Contributing
We welcome contributions to Ender! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and suggest improvements.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  Built with ❤️ by the Ender Team
</div>
