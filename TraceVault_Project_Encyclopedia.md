# 📚 The TraceVault Encyclopedia: Total-Massive Project Deep-Dive

This document is the definitive, high-fidelity technical specification for the **TraceVault** Digital Forensics & Integrity Platform. It covers everything from high-level philosophy to low-level byte-array logic.

---

## 🏛️ PART 1: The Core Philosophy
TraceVault is built on the principle of **"Mathematical Veracity."** In digital forensics, a file isn't just data; it's a piece of evidence. TraceVault exists to prove that from the moment of seizure (T0) to the moment of trial (Tn), the evidence has remained unchanged through a chain of cryptographic proofs.

### Why is this useful?
1. **Legal Admissibility**: Proves compliance with **ISO 27037** (Digital Evidence Handling).
2. **Internal Accountability**: Prevents "insider threats" from tampering with evidence.
3. **Investigation Efficiency**: Automates the detection of anomalies and tampering.

---

## 🔬 PART 2: Cryptographic & Forensic Logic
TraceVault utilizes a 4-tier integrity engine, documented below:

### 2.1 Level 1: Primary Fingerprinting (SHA-256)
Every file uploaded is immediately streamed through a `sha256` hashing pipeline. 
*   **Collision Probability**: $1$ in $2^{256}$. This ensures a unique identity for every file.
*   **Implementation**: Uses `crypto.createHash('sha256')` with Buffer streaming.

### 2.2 Level 2: Multi-Algorithm Verification
To ensure compatibility with global standards, TraceVault computes three hashes simultaneously.
*   **Hash Trio**: MD5 (128-bit), SHA-1 (160-bit), SHA-256 (256-bit).
*   **The Guard**: The system only marks evidence as "Verified" if ALL THREE hashes match the stored fingerprint.

### 2.3 Level 3: Chunk-Based Tamper Localization
*   **Logic**: Files are split into **4MB (4,194,304 bytes)** chunks.
*   **Audit**: If a file is tampered with, TraceVault performs a bit-by-bit comparison of each chunk and identifies the exact byte range where the modification occurred.

### 2.4 Level 4: The Merkle Tree Root
*   **Structure**: Every chunk hash becomes a "leaf" in a binary Merkle Tree.
*   **Anchor**: The root hash of this tree is the final, immutable anchor for the file's integrity. Even if chunks are moved, the root hash remains the source of truth.

---

## 🧠 PART 3: The Threat Intelligence Engine (Forensic Brain)
TraceVault doesn't just store files; it analyzes them for risk using a **Deterministic Rule Engine**.

### 3.1 The Risk Score Formula
Every piece of evidence is assigned a score (0–100) based on weighted triggers:
- **Integrity (60 pts)**: Hash mismatch / Tampering detected.
- **Access (30 pts)**: Unauthorized role attempt.
- **Behavior (25 pts)**: Rapid custody changes (>3/hour).
- **Source (20 pts)**: No custody chain or unknown uploader.

### 3.2 Real-Time Anomaly Detection Rules
The system runs constant background scans for 8 critical anomaly types:
1. **Off-Hours Access**: Any interaction between 00:00 and 06:00 local time.
2. **Impossible Travel**: A single user account accessing from 3+ distinct IP addresses in 24 hours.
3. **Massive Access**: >10 evidence items read by one user in 5 minutes (exfiltration warning).
4. **Brute Force**: >5 failed authentications from a single IP in 10 minutes.
5. **Privilege Escalation**: A user triggering 2+ "403 Forbidden" blocks in 24 hours.
6. **Extension Spoofing**: Matching file "magic bytes" (signatures) against its extension.

---

## 🗄️ PART 4: Data Architecture (The Forensic Ledger)
TraceVault organizes data into immutable-leaning MongoDB collections.

### 4.1 `evidences` Collection
Stores the primary forensic metadata:
- `file_hash`, `merkle_root`, `fuzzy_hash`.
- `integrity_status`: `verified`, `tampered`, `pending`.
- `encryption_iv` / `encryption_auth_tag`: For AES-256-GCM decryption.

### 4.2 `custody_events` Collection
A cryptographic sequence of "Hand-offs":
- `previous_event_hash`: Chains events together (like a blockchain).
- `actor_id` & `action`: Who did what (CAPTURE, TRANSFER, VERIFY, EXPORT).

---

## 📑 PART 5: The Forensic Reporting Framework
TraceVault generates high-fidelity legal reports using a dedicated service layer.

### 5.1 PDF Generation Logic
- **Automated Watermarks**: If a case is classified as "Secret" or "Top Secret," the engine injects a 15% opacity watermark across every page.
- **Forensic Detail Tables**: Reports include individual chunk hash tables and full Chain of Custody logs.
- **Digital Attestation**: Every report includes a mathematical statement of the standards followed (ISO 27037).

---

## 📡 PART 6: The API Registry (Core Endpoints)

| Endpoint | Method | Forensic Purpose |
| :--- | :--- | :--- |
| `/auth/login` | `POST` | Secure JWT Session Initiation. |
| `/evidence` | `POST` | Upload & Hardening (Hashing/Merkle/Encryption). |
| `/verify/:id` | `POST` | Trigger Deep Forensic Integrity Audit. |
| `/custody/:id` | `GET` | Retrieve Immutable Chain of Custody Timeline. |
| `/threat-intel` | `GET` | Retrieve Real-Time Anomaly & Risk Dashboard. |
| `/graph` | `GET` | Nodes/Edges for Suspect-File Relationship Graph. |

---

## ⚛️ PART 7: Frontend Component Architecture

### 7.1 Modern Tech Stack
- **React 18 + Vite**: High-performance rendering.
- **Zustand**: Global state for Auth, Notifications, and Theme.
- **React Query**: 15-second TTL caching for evidence lists.

### 7.2 custom UI Modules
- **`RelationshipGraph`**: D3-force based visualization of evidence-custodian links.
- **`AuditTimeline`**: Sequential animation of forensic events using Framer Motion.

---

## 🚀 PART 8: Infrastructure & Scaling
- **Zero-Downtime Redis**: Graceful fallback to DB-only mode if the cache fails.
- **S3 Multipart Uploads**: Supports evidence files up to **5 Terabytes** in size.
- **Docker Ready**: Fully containerized backend for horizontal scaling.

---

## 🌍 PART 9: Compliance & Standards
TraceVault is designed to meet the requirements of:
- **NIST SP 800-86**: Guide to Integrating Forensic Techniques into Incident Response.
- **ISO 27037**: Guidelines for identification, collection, acquisition, and preservation of digital evidence.
- **DOJ/FBI Standards**: Tamper-proof logging and digital signatures.

---

**TraceVault: Turning digital traces into undeniable, mathematically-proven truth.**
