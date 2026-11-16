# Er.NEXA — AI-Powered Project Knowledge Reconstruction Platform

Team Name: LAST COMMIT

Reconstruct Knowledge. Understand Projects. Build Better.


## 1. Project Introduction

Er.NEXA is an AI-powered full-stack platform designed to analyze complete or incomplete software projects and reconstruct their technical knowledge using Google's Gemini API.

It helps developers understand existing codebases, identify implemented functionalities, discover missing components, explore dependencies, and generate structured technical documentation without manually examining every file.

By combining AI-powered code analysis, evidence-based knowledge extraction, interactive visualizations, intelligent development planning, and team collaboration, Er.NEXA transforms complex software projects into understandable and actionable insights.

Unlike traditional code analysis tools, Er.NEXA focuses on understanding the overall project, reconstructing its knowledge, identifying development gaps, and helping developers decide what to build next.

The platform also provides a project-specific Electron desktop Launch Assistant for accessing and interacting with reconstructed project knowledge.

---

## 2. Project Information

| Information | Details |
|---|---|
| Project Name | Er.NEXA |
| Full Name | AI-Powered Project Knowledge Reconstruction Platform |
| Team Name | LAST COMMIT |
| Project Type | AI-Powered Full-Stack Web Application with Desktop Companion |
| Primary AI Engine | Google Gemini API |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Authentication |
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express.js, TypeScript |
| Desktop Technology | Electron |

---

## 3. Problem Statement

Software projects frequently become difficult to understand as their codebases grow and development continues across multiple contributors.

Developers often face challenges such as:

- Understanding unfamiliar or inherited codebases.
- Finding technical information scattered across source files.
- Identifying dependencies and relationships between modules.
- Understanding incomplete functionalities and unfinished tasks.
- Maintaining updated technical documentation.
- Tracking project decisions, progress, and future development.
- Transferring project knowledge between developers.

Traditional documentation and manual code inspection require considerable time and effort.

Er.NEXA addresses these challenges by automatically reconstructing structured project knowledge using AI and source-code analysis.

---

## 4. Key Features


### A. AI-Powered Project Knowledge Reconstruction

- **Project Upload and Analysis:** Import software projects through supported folder selection, ZIP uploads, and GitHub repository integration.
- **Automated Source Code Analysis:** Processes project files to understand the structure and implementation.
- **Technology Stack Detection:** Identifies technologies, frameworks, libraries, and dependencies.
- **Structured Project Summary:** Generates comprehensive technical summaries of the analyzed project.
- **Evidence-Based Knowledge:** Separates verified facts, AI inferences, and unknown information.
- **Functionality Understanding:** Identifies and explains implemented project functionalities.
- **Missing Information Detection:** Highlights incomplete or unclear project information.


### B. Project Visualization

- **Interactive Workflow Flowchart:** Generates visual representations of project workflows using Mermaid.js.
- **System Architecture Diagram:** Represents frontend, backend, databases, APIs, AI services, and their relationships.
- **Interactive Project Knowledge Graph:** Maps relationships between modules, files, dependencies, APIs, decisions, and project components.
- **Project Relationship Exploration:** Helps developers understand connections and dependencies across the codebase.


### C. Intelligent Development Planning

- **AI-Powered Development Roadmap:** Generates structured development phases, milestones, and recommended next steps.
- **Intelligent Task Suggestions:** Identifies unfinished work and recommends actionable development tasks.
- **Task Prioritization:** Helps organize tasks based on importance and dependencies.
- **Duplicate Task Prevention:** Helps avoid redundant task entries.
- **Project Progress Tracking:** Tracks development progress and task outcomes.
- **Project Completion Percentage:** Calculates project progress using completed, partially completed, and pending tasks.


### D. Continuous GitHub Synchronization

- Connect GitHub repositories with projects.
- Synchronize repository changes.
- Detect new commits and modified files.
- Refresh relevant project knowledge following repository updates.
- Keep reconstructed project information aligned with repository changes.


### E. AI Project Assistant

- Project-specific AI assistance.
- Context-aware project conversations.
- Assistance with understanding project functionality and technical structure.
- AI-powered project suggestions and development guidance.
- Separate Electron-based desktop Launch Assistant.


### F. Team Collaboration

- Individual messaging and group conversations.
- Group creation and member management.
- Group administration.
- Image, document, and file sharing.
- Project collaboration and knowledge-sharing support.


### G. Authentication and User Management

- Supabase-powered user registration and login.
- Personalized user dashboards.
- User profile management.
- Project-specific information management.
- Database-level access control using Row Level Security.

---





## 5. Three Major Round 3 Improvements

The following three improvements were committed during Round 2 and successfully implemented in Round 3.

### Improvement 1: Continuous GitHub Synchronization

**Round 2 Commitment:**

Implement continuous GitHub synchronization with repository integration, scheduled or event-driven updates, commit detection, changed-file detection, and automatic project knowledge refresh.

**Round 3 Delivery:**

Successfully implemented GitHub repository synchronization in Er.NEXA. Users can connect repositories, synchronize changes, detect new commits and modified files, and refresh associated project knowledge.

**Result:** Successfully implemented and functional.

### Improvement 2: Interactive Project Knowledge Graph

**Round 2 Commitment:**

Develop an interactive knowledge graph representing relationships between modules, files, dependencies, APIs, decisions, and project components.

**Round 3 Delivery:**

Successfully implemented an interactive project knowledge graph that visually represents project components and their relationships. Developers can explore connections and understand complex project structures more effectively.

**Result:** Successfully implemented and functional.

### Improvement 3: Intelligent Roadmap and Task Suggestions

**Round 2 Commitment:**

Improve AI-powered development planning by identifying project gaps, unfinished work, dependencies, and development requirements to generate prioritized tasks and actionable milestones.

**Round 3 Delivery:**

Successfully implemented intelligent roadmap and task suggestions. The system analyzes available project knowledge to identify development requirements, suggest tasks, consider dependencies, and provide actionable recommendations.

**Result:** Successfully implemented and functional.

---

## 6. Additional Improvements After Round 2

Apart from the three major commitments, additional improvements were implemented to expand Er.NEXA into a more complete development and collaboration platform.

- Integrated individual and group messaging.
- Group administration and member management.
- File, image, and document sharing.
- Project-specific desktop Launch Assistant.
- Enhanced user profile management.
- Improved project and task management.
- AI-based task suggestions and duplicate task prevention.
- Improved dashboard navigation and user experience.
- Enhanced project knowledge storage and retrieval.

---

## 7. Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Workflow Visualization | Mermaid.js |
| Interactive Graphs | React Flow |
| Backend | Node.js, Express.js, TypeScript |
| File Processing | Multer, Adm-Zip |
| AI Integration | Google Gemini API |
| AI SDK | `@google/generative-ai` |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Authentication |
| Security | Row Level Security, JWT, Bcrypt.js |
| Repository Integration | GitHub API |
| Desktop Application | Electron, IPC |
| Version Control | Git, GitHub |

---

## 8. Technical Architecture

Er.NEXA follows a modular full-stack architecture in which the frontend, backend, database, AI services, repository integration, and desktop companion work together.

### Architecture Components

**1. Frontend Layer**

React, TypeScript, Vite, and Tailwind CSS provide the user interface, dashboard, project workspace, interactive visualizations, and collaboration features.

**2. Backend Layer**

Node.js and Express.js handle API requests, business logic, file processing, project operations, and communication with external services.

**3. AI Processing Layer**

Google Gemini API processes extracted project information and supports project understanding, knowledge reconstruction, summaries, roadmap generation, and intelligent recommendations.

**4. Database Layer**

Supabase PostgreSQL stores user information, project records, and application data. Supabase Authentication manages user identity and access.

**5. Repository Integration Layer**

GitHub API enables repository connection, synchronization, and project update detection.

**6. Desktop Layer**

Electron provides a separate desktop companion that allows developers to interact with project-specific knowledge.

### System Data Flow

```text
             USER
              |
              v
      REACT FRONTEND
              |
              v
      EXPRESS BACKEND
              |
       +------+------+
       |      |      |
       v      v      v
    FILES  GITHUB  SUPABASE
   PROCESS  API    DATABASE
       |
       v
   CODE ANALYSIS
       |
       v
  GOOGLE GEMINI API
       |
       v
 PROJECT KNOWLEDGE
       |
   +---+----+---------+
   |        |         |
   v        v         v
 SUMMARY  DIAGRAMS  ROADMAP
   |        |         |
   +--------+---------+
            |
            v
     REACT DASHBOARD
            |
            v
    DESKTOP ASSISTANT
```

---

## 9. Project Workflow

Er.NEXA follows a structured workflow to convert software projects into meaningful technical knowledge.

1. **User Authentication:** Users register or log in through Supabase Authentication.
2. **Project Ingestion:** Users provide their software projects through supported upload methods or GitHub integration.
3. **File Processing:** Relevant source files, configuration files, and documentation are extracted.
4. **Code Analysis:** The backend processes project files and identifies structural information, technologies, and dependencies.
5. **AI Analysis:** Extracted project information is analyzed using the Google Gemini API.
6. **Knowledge Reconstruction:** The platform organizes information into structured project knowledge.
7. **Visualization:** Workflow diagrams, architecture diagrams, and knowledge graphs present project relationships.
8. **Development Planning:** The AI generates development suggestions, roadmaps, and task recommendations.
9. **Knowledge Management:** Users can access and manage their project information.
10. **Continuous Synchronization:** Connected GitHub repositories can be synchronized to keep project knowledge updated.
11. **Desktop Assistance:** Developers can interact with project-specific knowledge through the Electron Launch Assistant.

### AI Analysis Principles

Er.NEXA distinguishes between three types of information:

| Information Type | Description |
|---|---|
| Verified Facts | Information directly supported by project files. |
| AI Inferences | Reasonable conclusions derived from available evidence. |
| Unknown Areas | Information that cannot be confidently established. |

The platform aims to avoid fabricating project history, technical decisions, or implementation details.

---

## 10. Environment Variables (.env Configuration)

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

# Backend-only Supabase Configuration
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key

# Backend Configuration
PORT=5000
```

**Note:** Use the exact environment variable names expected by the application. If the project uses different names or separate frontend and backend environment files, follow the corresponding `.env.example` files.

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

### Important Security Notes

- Never upload your actual `.env` file to GitHub.
- Keep the Gemini API key and Supabase service role key strictly on the backend.
- Never expose the service role key through frontend variables.
- Use `.env.example` to share configuration requirements without exposing credentials.
- Ensure `.env` is included in `.gitignore`.

---

## 11. How to Run Locally

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
cd codesinpune-nexa
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

Create the required `.env` file or files and configure the Supabase and Gemini credentials as described in Section 10.

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

The application uses the following local service addresses:

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

**Production Build**

```bash
npm run build
```

**Code Quality Check**

```bash
npm run lint
```

---

## 12. Testing and Validation

Er.NEXA has undergone manual functional testing, integration testing, and end-to-end workflow validation.

### Areas Tested

- User registration, login, and authentication.
- Project creation and management.
- Project file uploads and source-code processing.
- Google Gemini API integration and AI-generated results.
- Project summaries and knowledge reconstruction.
- Workflow diagrams, architecture diagrams, and knowledge graphs.
- GitHub repository integration and synchronization.
- Roadmap generation and task management.
- Database storage and retrieval.
- Individual and group messaging.
- Desktop assistant functionality.
- User interface and application navigation.

### Testing Methods

- **Manual Testing:** Tested individual features and user interactions.
- **Integration Testing:** Checked communication between frontend, backend, database, AI services, and GitHub.
- **End-to-End Testing:** Validated complete workflows from authentication to project analysis and knowledge retrieval.
- **Functional Validation:** Compared generated project information with available source-code evidence.

### Known Limitations

- AI-generated information may require human verification.
- Analysis accuracy can vary with programming languages and repository complexity.
- Very large repositories may require additional performance optimization.
- Complex or indirect code dependencies may not always be reconstructed perfectly.
- Broader concurrent-user, security, and cross-platform testing remains an area for improvement.

Testing is an ongoing process, and we aim to improve reliability, performance, and AI accuracy continuously.

---

## 13. Product Roadmap and Future Development

Our future development will focus on improving AI code analysis accuracy, supporting more programming languages, automating technical documentation, enhancing real-time team collaboration, strengthening security, and optimizing performance for large repositories.

We plan to prioritize AI improvements first, followed by collaboration and enterprise-level scalability. These developments will benefit individual developers, project managers, and software development teams.

---

## 14. Live Demo and Deployment

**Live Application:**

https://lastcommit-nexa.vercel.app/

**GitHub Repository:**

https://github.com/dhumalmukundraj-max/codesinpune-nexa

The live application provides access to the Er.NEXA platform and its implemented capabilities.

---

## 15. Team Information

**Team Name: LAST COMMIT**

1.Mukundraj Babaso Dhumal
2.Aditya Ramesh Mali
3.Yogiraj Appaso Mali

We are the team behind Er.NEXA, working towards building an intelligent platform that simplifies software project understanding, technical documentation, collaboration, and development planning through AI-powered knowledge reconstruction.

Our goal is to make complex software projects easier to understand, maintain, analyze, and develop.

---

## Built with Dedication by Team LAST COMMIT

**Er.NEXA — Reconstruct Knowledge. Understand Projects. Build Better.**