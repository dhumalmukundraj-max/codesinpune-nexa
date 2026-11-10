# Er.NEXA — AI-Powered Project Knowledge Reconstruction Platform

**Team Name: LAST COMMIT**

---

## 1. Project Introduction

Er.NEXA is an AI-powered full-stack platform designed to analyze complete or incomplete software projects and reconstruct their technical knowledge using Google's Gemini API.

It helps developers understand existing codebases, identify implemented functionalities, discover missing components, and generate structured technical documentation without manually examining every file.

By combining AI-powered code analysis, evidence-based knowledge extraction, interactive diagrams, and development planning, Er.NEXA transforms complex software projects into understandable and actionable insights.

The platform also includes a project-specific desktop Launch Assistant that provides quick access to reconstructed project knowledge.

## 2. Project Information

**Project Name:** Er.NEXA  
**Full Name:** AI-Powered Project Knowledge Reconstruction Platform  
**Team Name:** LAST COMMIT  
**Project Type:** AI-Powered Full-Stack Web Application with Desktop Companion  
**Primary AI Engine:** Google Gemini API  
**Database:** Supabase PostgreSQL  

### Key Features

- **Project Upload & Analysis:** Accepts projects through browser folder selection, ZIP uploads, local paths, and authorized GitHub repositories.
- **Structured Project Summary:** Generates technical documentation covering functionalities, dependencies, decisions, verified facts, AI inferences, and unknown areas.
- **Interactive Workflow Flowchart:** Visualizes project workflows using Mermaid.js with zoom, pan, and PNG/SVG export.
- **System Architecture Diagram:** Represents frontend, backend, database, APIs, and their relationships based on project evidence.
- **Development Roadmap:** Identifies development phases, milestones, dependencies, and recommended next steps.
- **Project Completion Percentage:** Calculates progress using identified completed, partially completed, and pending tasks.
- **Desktop Launch Assistant:** Provides a floating Electron-based companion with project-specific context and source citations.
- **Authentication & Access Control:** Supports secure authentication, project isolation, and role-based permissions.

## 3. Technology Stack Used

| Category | Technologies |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Diagrams | Mermaid.js |
| Backend | Node.js, Express.js, TypeScript |
| File Processing | Multer, Adm-Zip |
| AI Integration | Google Gemini API (`@google/generative-ai`) |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Authentication |
| Security | Row Level Security (RLS), JWT, Bcrypt.js |
| Desktop Application | Electron, IPC |
| Development Tools | npm, Git, GitHub |

## 4. Project Workflow

Er.NEXA follows a structured workflow to convert software projects into meaningful technical knowledge.

1. **User Authentication:** Users register or log in through Supabase Authentication.
2. **Project Ingestion:** Users provide their software project through folder selection, ZIP upload, local path, or GitHub repository.
3. **File Filtering:** The system filters unnecessary files, dependencies, binaries, and sensitive credentials before analysis.
4. **Project Processing:** Relevant source files, configuration files, and documentation are extracted and processed.
5. **AI Analysis:** The Google Gemini API analyzes the project and reconstructs its technical knowledge using structured outputs.
6. **Knowledge Generation:** The platform generates project summaries, workflow diagrams, architecture diagrams, roadmaps, and completion reports.
7. **Visualization:** Generated information is presented through interactive dashboards and Mermaid.js diagrams.
8. **Project Management:** Users can review, manage, and access project-specific information according to their permissions.
9. **Desktop Assistance:** The Electron Launch Assistant provides quick access to the selected project's reconstructed knowledge.

### AI Analysis Principles

Er.NEXA maintains a clear distinction between:

- **Verified Facts:** Information directly supported by project files.
- **AI Inferences:** Reasonable conclusions derived from available evidence.
- **Unknown Areas:** Information that cannot be confidently established.

The platform avoids fabricating project history, technical decisions, or implementation details.

## 5. Environment Variables (.env Configuration)

Er.NEXA requires environment variables to connect external services securely.

### Step 1: Create the Environment File

Create a `.env` file in the root directory of the project.

You can use the provided `.env.example` file as a template.

### Step 2: Configure API Credentials

Add your actual credentials to the `.env` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key

# Backend Configuration
PORT=5000
```

### Step 3: Obtain Required Credentials

**Supabase:**
1. Visit https://supabase.com/dashboard
2. Create a Supabase project.
3. Navigate to Project Settings → API Keys.
4. Copy your project URL and publishable/anonymous key.
5. Obtain the service role key for backend-only operations.

**Google Gemini API:**
1. Visit https://aistudio.google.com/apikey
2. Generate a Gemini API key.
3. Add it to the `GEMINI_API_KEY` variable.

### Step 4: Initialize the Database

1. Open your Supabase project dashboard.
2. Navigate to SQL Editor.
3. Open `supabase/schema.sql` from the project.
4. Execute the complete SQL script.
5. Verify that the required tables, triggers, and RLS policies have been created.

**Important Security Notes:**
- Never upload your actual `.env` file to GitHub.
- Keep the Gemini API key and Supabase service role key strictly on the backend.
- Never expose the service role key through frontend variables.
- Use `.env.example` to share configuration requirements without exposing credentials.
- Ensure `.env` is included in `.gitignore`.

## 6. How to Run Locally

Follow these steps to set up and run Er.NEXA on your local machine.

### Prerequisites

Install the following before starting:

- Node.js (LTS version recommended)
- npm
- Git
- Supabase account
- Google Gemini API key

### Step 1: Clone the Repository

```bash
git clone https://github.com/dhumalmukundraj-max/codesinpune-nexa.git
```

Navigate into the project directory:

```bash
cd Er.NEXA
```

### Step 2: Install Dependencies

Install the root dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd server
npm install
```

Install frontend dependencies:

```bash
cd ../client
npm install
```

Return to the root directory:

```bash
cd ..
```

### Step 3: Configure Environment Variables

Create the root `.env` file and configure the required Supabase and Gemini credentials as described in Section 5.

### Step 4: Initialize Supabase

Execute the SQL script located at:

```text
supabase/schema.sql
```

Run it through the Supabase SQL Editor.

### Step 5: Start the Application

From the project root, execute:

```bash
npm run dev
```

The application starts with the following local services:

| Service | Local URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000 |

### Step 6: Launch Desktop Assistant (Optional)

To start the Electron desktop companion:

```bash
npm run desktop
```

To launch it with a specific project:

```bash
npm run desktop -- --project=<project-id>
```

### Additional Commands

**Production Build:**

```bash
npm run build
```

**Code Quality Check:**

```bash
npm run lint
```

## 7. Live Demo & Deployment

**Live Application URL:**  
https://lastcommit-nexa.vercel.app/

**GitHub Repository:**  
https://github.com/dhumalmukundraj-max/codesinpune-nexa.git

The live deployment link will be updated once the application is successfully deployed and publicly accessible.

## 8. Team Information

**Team Name: LAST COMMIT**

We are the team behind Er.NEXA, working towards building an intelligent platform that simplifies software project understanding, technical documentation, and development planning through AI-powered knowledge reconstruction.

Our goal is to make complex software projects easier to understand, maintain, analyze, and develop.

---

**Built with dedication by Team LAST COMMIT.**

**Er.NEXA — Reconstruct Knowledge. Understand Projects. Build Better.**