# TraceVault: Master Project Report Generation Prompt

This document contains the **Master Prompt** designed to generate a comprehensive, 100-page style project report for **TraceVault**. 

> [!TIP]
> **Instructions for use:**
> 1. Copy the entire section under "THE MASTER PROMPT" below.
> 2. Paste it into a high-context AI model (like Gemini 1.5 Pro or GPT-4o).
> 3. If the AI stops due to output limits, simply type "Continue from [Last Section]" to complete the 100-page depth.

---

# THE MASTER PROMPT

**Role:** You are a Senior Forensic Systems Architect and Academic Technical Writer.
**Task:** Generate a massive, professional project report (approx. 100 pages depth) for a project titled **TraceVault: Digital Evidence Integrity & Chain-of-Custody Platform**. 
**Core Data Source:** I am providing a massive Technical Encyclopedia of the project. Use the details from it (Mathematics, Anomaly Detection rules, API Registry, Forensic logic) to populate the chapters with high-fidelity technical depth.

## PROJECT CONTEXT: TraceVault
TraceVault is a high-security "Digital Evidence Management System" (DEMS) built to ensure the mathematical integrity of digital artifacts for legal proceedings. It uses advanced cryptographic hashing, immutable audit logging, and relationship graphing to protect the chain of custody.

### Technical Stack:
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Shadcn/UI, Zustand (State), React Query.
- **Backend**: Node.js 20, Fastify (High-performance framework), Zod (Validation).
- **Database**: MongoDB Atlas (Mongoose ODM).
- **Cashing/Real-time**: Upstash Redis.
- **Storage**: AWS S3 / Cloudflare R2 (Encrypted).
- **Security**: JWT (Access/Refresh tokens), Bcrypt, AES-256-GCM encryption, HMAC for integrity.

---

## REPORT STRUCTURE & CHAPTERS:

### Chapter 1: Introduction (10 pages depth)
- **1.1 Project Overview**: Abstract of TraceVault as a Digital Locker.
- **1.2 Motivation**: Why current evidence storage fails (tampering, deletion).
- **1.3 Problem Statement**: The "Mumbai Bank Fraud" case study (example).
- **1.4 Objectives**: Integrity, Accountability, Scalability.
- **1.5 Scope**: Forensic labs, Law Enforcement, Legal departments.

### Chapter 2: Literature Review (10 pages depth)
- **2.1 Evolution of Digital Forensics**: From disk imaging to cloud forensics.
- **2.2 Existing Systems**: Analyzing EnCase, FTK, and Magnet AXIOM.
- **2.3 Gaps & Innovation**: Why TraceVault’s real-time integrity is superior.
- **2.4 Regulatory Compliance**: ISO 27037 and Indian IT Act 2000 (Section 65B).

### Chapter 3: Requirement Analysis (15 pages depth)
- **3.1 Functional Requirements**:
  - Unified Case Management.
  - Multi-hash (SHA-256, SHA-512, MD5) evidence fingerprinting.
  - Immutable Chain of Custody (Logbook).
  - Anomaly Detection (Threat Intel).
  - Forensic Activity Timelines.
- **3.2 Non-Functional Requirements**:
  - Zero-Trust security model.
  - Sub-100ms API response time via Fastify.
  - Infinite scalability via MongoDB Atlas.
- **3.3 System Requirements**: Hardware specifics (RAM, CPU) and Software versions.

### Chapter 4: System Architecture & Design (15 pages depth)
- **4.1 Architecture Diagram**: Detail the flow from Browser -> Vite Proxy -> Fastify -> MongoDB.
- **4.2 Component Design**: Describe the "Locker" system vs the "Analysis" system.
- **4.3 Database Schema**: Explain the following models in detail:
  - **Evidence**: Fields for `file_hash`, `merkle_root`, `chunk_hashes`, `integrity_status`.
  - **Case**: Linking evidence to investigators.
  - **CustodyEvent**: Recording every "hand-off" between users.
  - **AuditLog**: Recording every single click/read event.
- **4.4 UI/UX Design**: The "Deep Tech" aesthetic (Dark mode, glassmorphism, Framer Motion).

### Chapter 5: Security & Forensic Logic (15 pages depth)
- **5.1 Multi-Layered Hashing**: Explain Chunk-based hashing (4MB blocks) for large files.
- **5.2 Merkle Tree Integration**: How TraceVault proves a single chunk's integrity without scanning the whole file.
- **5.3 Encryption at Rest**: AES-256-GCM logic for sensitive file storage.
- **5.4 Chain of Custody Logic**: The mathematical link between previous and current holders.

### Chapter 6: Implementation Details (15 pages depth)
- **6.1 Backend API Design**: List routes like `/evidence`, `/verify`, `/threat-intel`, `/graph`.
- **6.2 State Management**: How Zustand handles real-time notifications.
- **6.3 Foreground/Background Tasks**: Redis-backed workers for hash computation.

### Chapter 7: Results & Screenshot Guidance (15 pages depth)
**[For this section, generate placeholders like this: [DESCRIPTION OF SCREENSHOT] and explain what it proves]**
- **Dashboard**: Real-time stats.
- **Evidence Manager**: List of secured files.
- **Verification Page**: Pass/Fail forensic reports.
- **Relationship Graph**: Visual node-link analysis.
- **Forensic Timeline**: Chronological event log.

### Chapter 8: Conclusion & Future Scope (5 pages)
- **8.1 Summary of Work**.
- **8.2 Future Roadmap**: Blockchain anchoring, AI-auto-investigation.

---

## OUTPUT FORMATTING RULES:
1. Use **Professional Academic Tone**.
2. Include **Mathematical Formulas** for Hashing (SHA-256) and Shannon Entropy.
3. Use **Mermaid.js code blocks** for diagrams.
4. Use **Markdown Tables** for requirement analysis.
5. Create **"Researcher's Notes"** callouts for technical deep-dives.

**GO! BEGIN GENERATING FROM CHAPTER 1.**
