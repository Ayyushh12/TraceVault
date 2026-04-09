/**
 * Forensic Analysis Service
 * 
 * Performs deep inspection of evidence files:
 *  - Hex dump generation
 *  - Entropy calculation (detect encryption/compression)
 *  - Magic bytes detection
 *  - String extraction (ASCII/UTF-8)
 */

import { getStorageDriver } from '../forensics/storageEngine.js';
import { decryptBuffer } from '../crypto/cryptoEngine.js';
import Evidence from '../models/Evidence.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

class ForensicAnalysisService {
    /**
     * Inspect a file deeply for forensic metadata.
     */
    async analyzeEvidenceFile(evidenceId, mcpContext) {
        const evidence = await Evidence.findOne({ evidence_id: evidenceId }).lean();
        if (!evidence) {
            throw new NotFoundError('Evidence');
        }

        const storage = getStorageDriver();
        const encryptedBuffer = await storage.read(evidence.storage_path);
        if (!encryptedBuffer) {
            throw new Error(`Storage driver returned null for path: ${evidence.storage_path}`);
        }
        const buffer = decryptBuffer(
            encryptedBuffer,
            evidence.encryption_iv,
            evidence.encryption_auth_tag || null
        );

        // 1. Calculate Shannon Entropy
        const entropy = this._calculateEntropy(buffer);

        // 2. Generate Hex Dump (first 512 bytes)
        const hexDumpLength = Math.min(buffer.length, 512);
        const hexDump = this._generateHexDump(buffer.slice(0, hexDumpLength));

        // 3. Detect Magic Bytes
        const magicBytes = this._detectMagicBytes(buffer);

        // 4. Extract printable strings (min length 6, first 100 results)
        const strings = this._extractStrings(buffer, 6, 100);

        logger.info({ evidenceId, entropy }, 'Deep forensic analysis completed');

        return {
            evidence_id: evidenceId,
            file_name: evidence.original_name,
            file_size: buffer.length,
            analysis: {
                entropy: parseFloat(entropy.toFixed(4)),
                is_encrypted_or_compressed: entropy > 7.5,
                magic_bytes_detected: magicBytes,
                hex_dump: hexDump,
                extracted_strings: strings,
            },
            analyzed_at: new Date().toISOString()
        };
    }

    _calculateEntropy(buffer) {
        if (buffer.length === 0) return 0;
        
        const counts = new Array(256).fill(0);
        for (let i = 0; i < buffer.length; i++) {
            counts[buffer[i]]++;
        }

        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (counts[i] > 0) {
                const p = counts[i] / buffer.length;
                entropy -= p * Math.log2(p);
            }
        }
        return entropy;
    }

    _generateHexDump(buffer) {
        const lines = [];
        for (let i = 0; i < buffer.length; i += 16) {
            const chunk = buffer.slice(i, i + 16);
            
            // Offset
            const offset = i.toString(16).padStart(8, '0');
            
            // Hex view
            const hex = Array.from(chunk)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ')
                .padEnd(47, ' '); // 16 * 3 - 1
            
            // ASCII view
            const ascii = Array.from(chunk)
                .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
                .join('');
                
            lines.push(`${offset}  ${hex}  |${ascii}|`);
        }
        return lines.join('\n');
    }

    _detectMagicBytes(buffer) {
        if (buffer.length < 4) return 'Unknown (file too small)';
        
        const hex = Array.from(buffer.slice(0, 4))
            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');

        // known signatures
        const signatures = {
            '89 50 4E 47': 'PNG Image',
            'FF D8 FF E0': 'JPEG Image',
            'FF D8 FF E1': 'JPEG Image',
            '25 50 44 46': 'PDF Document',
            '50 4B 03 04': 'ZIP Archive (or DOCX/XLSX)',
            '52 61 72 21': 'RAR Archive',
            '49 44 33': 'MP3 Audio',
            '52 49 46 46': 'WAV/AVI (RIFF handler)',
            '4D 5A': 'Windows Executable (EXE/DLL)',
            '7F 45 4C 46': 'Linux Executable (ELF)'
        };

        for (const [sig, desc] of Object.entries(signatures)) {
            if (hex.startsWith(sig)) return desc;
        }

        // Just check MZ
        if (buffer[0] === 0x4D && buffer[1] === 0x5A) return 'Windows Executable (EXE/DLL)';

        return 'Unknown / Raw Data';
    }

    _extractStrings(buffer, minLength, maxLimit) {
        const strings = [];
        let currentString = '';

        for (let i = 0; i < buffer.length; i++) {
            const charCode = buffer[i];
            
            // printable ascii
            if (charCode >= 32 && charCode <= 126) {
                currentString += String.fromCharCode(charCode);
            } else {
                if (currentString.length >= minLength) {
                    strings.push({ offset: i - currentString.length, text: currentString });
                    if (strings.length >= maxLimit) break;
                }
                currentString = '';
            }
        }
        
        if (currentString.length >= minLength && strings.length < maxLimit) {
            strings.push({ offset: buffer.length - currentString.length, text: currentString });
        }

        return strings;
    }
}

export const forensicAnalysisService = new ForensicAnalysisService();
