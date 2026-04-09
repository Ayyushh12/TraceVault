# TraceVault — Enterprise Digital Forensics & Chain of Custody Platform

TraceVault is a high-fidelity, production-grade digital forensics management system designed to uphold the highest standards of evidentiary integrity. Built with a focus on precision, security, and intuitive data visualization, TraceVault provides forensic investigators with a centralized environment to manage cases, track evidence, and maintain an immutable chain of custody.

## 🛡️ Core Pillars

- **Evidentiary Integrity**: Automated cryptographic hash verification to detect and alert on any unauthorized data tampering.
- **Immutable Chain of Custody**: Real-time tracking of evidence transfers, ensuring legal admissibility and chronological transparency.
- **Advanced Analytics**: Granular insights into forensic activities, case progression, and evidence health via a high-performance dashboard.
- **Enterprise Security**: Industry-standard authentication (MFA), session auditing, and robust role-based access controls.

## ✨ Key Features

### 📊 Forensic Intelligence Dashboard
A centralized hub providing real-time statistics on case status, evidence health (Verified/Pending/Tampered), and recent audit events. Designed with a high-fidelity interface for immediate situational awareness.

### 📁 Case Management
Comprehensive handling of complex forensic investigations. Organize digital evidence by case, maintain investigator notes, and track progression through modular workflows.

### ⛓️ Chain of Custody (CoC) Timeline
A visual, chronological record of every interaction with a piece of evidence. Every transfer, review, and modification is logged with a secure audit trail, ensuring compliance with judicial standards.

### 🔍 Evidence Analytics & Search
Rapid intake and categorization of digital assets. Supports advanced filtering, detailed metadata extraction, and visual timelines for complex evidentiary patterns.

### 📜 Automated Reporting
Generate professional, high-fidelity forensic reports suitable for legal proceedings. Includes automated audit trails, integrity logs, and case summaries.

### 🔐 Security & Compliance
- **Multi-Factor Authentication (MFA)**: Secure entry via time-based OTP.
- **Audit Logging**: Comprehensive tracking of all system interactions (endpoints, actors, status codes).
- **Session Monitoring**: Real-time management of active investigator sessions.

## 🚀 Technology Stack

TraceVault is engineered using a modern, high-performance web stack:

- **Frontend**: [React 18](https://reactjs.org/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **UI Architecture**: [Radix UI](https://www.radix-ui.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [GSAP](https://greensock.com/gsap/) & [Framer Motion](https://www.framer.com/motion/) for fluid, professional interactions
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query/latest)
- **Utilities**: `date-fns`, `lucide-react`, `recharts`

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18.0.0 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Tracevault
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## 🏗️ Project Structure

```text
src/
├── components/     # High-fidelity UI components & Shadcn primitives
├── hooks/          # Custom React hooks for API interaction & state
├── lib/            # Utility functions & global configurations
├── pages/          # Full-page forensic modules (Dashboard, Case Mgmt, etc.)
├── store/          # Zustand state management (Auth, UI state)
└── types/          # Global TypeScript interface definitions
```

## ⚖️ License

All rights reserved. Property of the TraceVault Development Team.
