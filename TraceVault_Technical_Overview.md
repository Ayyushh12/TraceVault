# TraceVault: Forensic Deep-Dive & Technical Overview

This document provides a "Master Level" technical breakdown of the **TraceVault** project. It is designed to explain *exactly* how the systems work and why they are vital for high-stakes digital forensics.

---

## 1. The Core Hashing Engine (The Mathematical Truth)
TraceVault doesn't just "save" files. it applies a **Triple-Seal** integrity process.

### 1.1 Multi-Algorithm Fingerprinting
Every artifact is hashed using:
- **SHA-256**: The industry standard for high-security integrity.
- **SHA-1 & MD5**: Included for cross-compatibility with older forensic tools (like Autopsy) and legal requirements in legacy jurisdictions.
- **Trust Factor**: If even one of these three hashes deviates, the evidence is immediately flagged as **Tampered**.

### 1.2 Chunk-Based Integrity (4MB Blocks)
Following the standard set by tools like **EnCase**, TraceVault splits large files into 4MB chunks. 
- **The Process**: Each chunk is hashed individually. These hashes form the leaves of a **Merkle Tree**.
- **The Utility**: If a suspect modifies only 1KB of data inside a 50GB database file, TraceVault can point to the exact 4MB chunk that was modified rather than just a generic "file failed" message.

### 1.3 Fuzzy Hashing (Detecting "Almost" Identical Files)
Using rolling-window hashing (inspired by **SSDEEP**), the system generates a "similarity token."
- **How it works**: It calculates a hash based on the content patterns, not just bit-for-bit identity. 
- **Usefulness**: An investigator can use this to find a slightly edited version of a ransom note, or a malware sample that has been slightly modified by a hacker to evade standard antivirus detection.

---

## 2. Advanced Forensic Validation

### 2.1 Shannon Entropy (The Noise Meter)
TraceVault calculates the entropy of every file on a scale of **0.0 to 8.0**.
- **High Entropy (> 7.5)**: The file is likely encrypted or contains high-density compressed data.
- **Significance**: If a file looks like a `.txt` but has 7.9 entropy, the investigator knows it's likely a hidden encrypted container (steganography).

### 2.2 Magic Byte Signatures
The platform intercepts the first few bytes of every file to verify its "Magic Signature."
- **Example**: A file ending in `.jpg` must start with `FF D8 FF`. 
- **Benefit**: This stops **Extension Spoofing**, a common technique used by insiders to hide sensitive databases by renaming them to innocent-looking image files.

---

## 3. High-Security Command Center (OWASP Guard)

### 3.1 NoSQL Injection Prevention
Our `owaspSecurity.js` middleware performs deep recursive scanning on every API request. It automatically detects and blocks JSON payloads containing MongoDB operators (like `$gt` or `$regex`) that could be used to bypass login logic or leak the entire user database.

### 3.2 Trusted Timestamping
TraceVault implements a persistent **HMAC-SHA256** trusted timestamp. By signing the File Hash + ISO-Timestamp with a secret server-side key, we create a "Timestamp of Truth." This proves the evidence existed in its current form at a specific millisecond, preventing "Backdating" of evidence.

### 3.3 immutable Chain of Custody (Logbook)
Every "Hand-off" (transfer) is recorded in a cryptographically linked chain.
- `Event(n) = Hash(Event(n-1) + CurrentData)`
- This makes the history of the evidence "Hash-Linked." If an administrator tries to delete a log entry from 3 months ago, the entire subsequent chain will break, acting as a "Silent Alarm."

---

## 4. UI/UX Highlights

### 4.1 Relationship Intelligence Graph
The graph visualization isn't just a pretty picture—it's a **Relationship Discovery Engine**. It maps interactions between:
- **Entities**: Users, Cases, IP Addresses.
- **Edges**: "Uploaded," "Accessed," "Transferred," "Archived."
- **Case Use**: It reveals if the same IP address was used to access three different evidence files across different cases, potentially identifying a "Serial Mole" inside the organization.

### 4.2 Forensic Timeline
A millisecond-accurate "Crime Ledger" that provides an interactive scrollable view of every forensic event in chronological order.

---

## 📝 Screenshot Checklist (for the 100-page report)

| Figure | Image Title | App Page/Route | Technical Proof |
| :--- | :--- | :--- | :--- |
| **Fig 1.1** | Forensic Command Dashboard | `/dashboard` | Proof of overall system health. |
| **Fig 2.4** | Multi-Hash Verification Panel | `/verify` | Proof of SHA-256 and MD5 integrity verification. |
| **Fig 3.2** | Chain of Custody Log | `/custody` | Proof of the immutable transfer history. |
| **Fig 4.1** | Relationship Node Map | `/graph` | Proof of link analysis and entity discovery. |
| **Fig 5.5** | OWASP Security Block | `/admin` (Log view) | Proof of blocked NoSQL Injection attempt. |
