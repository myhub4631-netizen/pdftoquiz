# QuestionForge AI

> **AI-Powered NEET & JEE PDF Question Paper → Excel Question Bank Maker**
> Multi-user SaaS application built with Next.js 15, TypeScript, Tailwind CSS, Supabase (Auth, DB, RLS, Storage), OpenRouter AI Provider architecture, and multi-sheet Excel generation.

---

## 🌟 Key Features

1. **Intelligent PDF Question Extraction**:
   - Parses complex 180-question and 200-question NEET papers, JEE Main (90 questions), and JEE Advanced.
   - Robust pattern boundary detection (`1.`, `Q1.`, `Question 1`, `(A)/(B)/(C)/(D)`).
   - Preserves mathematical formulas, superscripts, subscripts, fractions, and Greek symbols.

2. **Semantic Diagram & Image Processing**:
   - Extracts diagrams, graphs, circuits, and chemical structures.
   - Accurately associates images with the question statement or specific options (Option A, B, C, D).
   - Multi-level compression (Original, Low, Medium, High, Maximum) via `sharp`.
   - Line-art SVG vectorization via `potrace`.
   - Optional lossless dual-storage (`/images/original/` and `/images/optimized/`).

3. **Master Admin AI / OpenRouter Portal**:
   - Dynamic OpenRouter API Key configuration without modifying code or redeploying.
   - AES-256-GCM encryption on server; masked key (`sk-or-v1-••••••••9X2K`) in UI.
   - Multi-model routing: Primary Model (`google/gemini-2.5-flash`), Vision Model, and Fallback Model (`meta-llama/llama-3.3-70b-instruct`).
   - Live **[ Test Connection ]** button.
   - Automated failover (Primary → Fallback → Flag for Review).
   - Telemetry: Requests today/month, token consumption, success rates, and immutable audit logs.

4. **Human Review System**:
   - Interactive split-pane editor: Question list with confidence badges (Green/Yellow/Red) on the left; rich question/options/diagram editor on the right.
   - Single-click **[ Mark as Reviewed ]**, formula editing, and question reordering.

5. **Multi-Sheet Excel Generation**:
   - Generates `.xlsx` workbooks with 3 styled sheets:
     - **Sheet 1: Questions**: Clean columns with embedded images anchored directly inside cells!
     - **Sheet 2: Metadata**: Exam type, year, question counts per subject (Physics, Chemistry, Biology, Mathematics), processing timestamp.
     - **Sheet 3: Extraction Report**: Confidence audit and review flags.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ or 22+
- npm or pnpm
- Supabase account (or local Supabase CLI)
- OpenRouter API Key (optional for mock tests, required for live AI extraction)

### 2. Installation
```bash
git clone https://github.com/your-org/questionforge-ai.git
cd questionforge-ai
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Populate the following:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
ENCRYPTION_SECRET=your-32-byte-hex-secret-for-aes-256
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_VISION_MODEL=google/gemini-2.5-flash
OPENROUTER_FALLBACK_MODEL=meta-llama/llama-3.3-70b-instruct
```

### 4. Database Setup (Supabase)
Run the SQL migration in `supabase/migrations/20260906000001_initial_schema.sql` via the Supabase SQL Editor. This sets up:
- Profiles, Projects, Documents, Questions, Options, Images, Processing Jobs, AI Settings, and Audit Logs.
- Strict Row Level Security (RLS) policies.
- Auto-profile creation trigger on user signup.

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛡️ Master Admin Initial Setup

1. Sign up or create a user in Supabase Auth.
2. In Supabase SQL Editor or Table Editor, set `role = 'MASTER_ADMIN'` on your user's row in `public.profiles`.
3. Navigate to `/admin/ai` to configure your OpenRouter API key, test connection, and adjust hyperparameters.

---

## 📁 Repository Structure

```text
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/          # User KPI dashboard & recent projects
│   │   │   ├── projects/           # Project list & search
│   │   │   ├── projects/new/       # PDF upload & image settings
│   │   │   ├── projects/[id]/      # Live progress tracker & stats
│   │   │   ├── projects/[id]/review/ # Split Human Review Editor
│   │   │   └── exports/            # Export history
│   │   ├── (admin)/admin/
│   │   │   ├── page.tsx            # Master Admin Overview
│   │   │   ├── ai/page.tsx         # OpenRouter API & Model Settings
│   │   │   ├── users/page.tsx      # User management
│   │   │   ├── jobs/page.tsx       # Processing jobs monitor
│   │   │   ├── storage/page.tsx    # Storage quotas
│   │   │   ├── settings/page.tsx   # System branding
│   │   │   └── audit-logs/page.tsx # Security audit logs
│   │   ├── api/                    # Server-side Next.js API routes
│   │   └── globals.css             # Glassmorphic dark styling
│   ├── lib/
│   │   ├── ai/                     # OpenRouter client, AES encryption, model fallback
│   │   ├── pdf/                    # PDF text parser & boundary segmenter
│   │   ├── image/                  # Sharp compression, SVG potrace, spatial association
│   │   ├── excel/                  # Multi-sheet ExcelJS generator with embedded drawings
│   │   ├── processing/             # Pipeline orchestration engine
│   │   └── supabase/               # Client, server, and admin clients
│   └── types/                      # TypeScript database and schema types
├── scripts/
│   ├── export_openpyxl.py          # Python openpyxl companion generator
│   └── test-runner.mjs             # Automated verification suite
└── supabase/
    └── migrations/                 # PostgreSQL migrations & RLS
```

---

## 🔒 Security Architecture

- **Zero API Key Leakage**: Keys are encrypted with AES-256-GCM before DB insertion and decrypted strictly on the server when making OpenRouter calls.
- **Tenant Isolation**: Supabase Row Level Security ensures users can only access their own documents, questions, and exports.
- **Audit Logs**: Master Admin configuration modifications are logged with actor details and timestamps.

---

## 📄 License
MIT License.
