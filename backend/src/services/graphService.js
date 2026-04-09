import Evidence from '../models/Evidence.js';
import User from '../models/User.js';
import Case from '../models/Case.js';
import CustodyEvent from '../models/CustodyEvent.js';
import AuditLog from '../models/AuditLog.js';

export class GraphService {
    async generateGraphData() {
        const nodes = [];
        const edges = [];
        const nodeSet = new Set();
        
        const addNode = (id, label, type, risk = false) => {
            if (!nodeSet.has(id)) {
                nodes.push({ id, label, type, risk });
                nodeSet.add(id);
            }
        };

        const addEdge = (source, target, label) => {
            if (nodeSet.has(source) && nodeSet.has(target)) {
                edges.push({ source, target, label });
            }
        };

        const [evidences, users, cases, custodyEvents, audits] = await Promise.all([
            Evidence.find({}).lean(),
            User.find({}).lean(),
            Case.find({}).lean(),
            CustodyEvent.find({}).lean(),
            AuditLog.find({ action: { $in: ['CREATE:AUTH', 'POST:AUTH'] } }).limit(500).lean() // correctly fetch auth events
        ]);

        // Add User Nodes
        users.forEach(u => addNode(`usr-${u.user_id || u._id}`, u.username || 'Unknown User', 'user'));

        // Add Case Nodes
        cases.forEach(c => addNode(`cas-${c.case_id}`, c.case_name || 'Unknown Case', 'case'));

        // Add Evidence Nodes
        evidences.forEach(e => {
            const risk = e.integrity_status === 'tampered' || (e.forensic_analysis?.entropy?.risk === 'critical');
            addNode(`evd-${e.evidence_id}`, e.original_name || 'Evidence', 'evidence', risk);
            
            // Link Evidence to Uploader (Strong correlation)
            if (e.uploaded_by) {
                addEdge(`usr-${e.uploaded_by}`, `evd-${e.evidence_id}`, 'UPLOADED_BY');
            }
            
            // Link Evidence to Case (Grouping)
            if (e.case_id) {
                addEdge(`cas-${e.case_id}`, `evd-${e.evidence_id}`, 'CONTAINS_EVIDENCE');
            }
        });

        // Add Custody Links (Multi-user overlap discovery)
        custodyEvents.forEach(evt => {
            const actor = evt.actor_id;
            const evidence = evt.evidence_id;
            if (actor && evidence) {
                const action = evt.action === 'CREATE_EVIDENCE' ? 'UPLOADED' : 
                               evt.action === 'VERIFY_EVIDENCE' ? 'VERIFIED' : 
                               evt.action === 'TRANSFER_CUSTODY' ? 'TRANSFERRED' : 'ACCESSED';
                addEdge(`usr-${actor}`, `evd-${evidence}`, action);
            }
        });

        // Add IP Logins & Cross-Contamination (Threat pattern analysis)
        const ipUserMap = new Map();
        audits.forEach(audit => {
            const ip = audit.ip_address;
            const user = audit.user_id;
            if (ip && user && ip !== '127.0.0.1' && ip !== '::1') { // Filter out local dev IPs to avoid false mass-clustering
                const ipId = `ip-${ip.replace(/\./g, '-')}`;
                // Flag IP as risk if multiple failed logins
                const isFailed = (audit.status_code || 200) >= 400;
                addNode(ipId, ip, 'ip', isFailed);
                addEdge(`usr-${user}`, ipId, isFailed ? 'FAILED_LOGIN' : 'LOGGED_IN_FROM');

                // Track users per IP
                if (!ipUserMap.has(ipId)) ipUserMap.set(ipId, new Set());
                ipUserMap.get(ipId).add(`usr-${user}`);
            }
        });

        // Deep Discovery: Link users who share the same IP (Forensic lateral movement)
        for (const [ipId, userSet] of ipUserMap.entries()) {
            if (userSet.size > 1) {
                const sharedUsers = Array.from(userSet);
                for (let i = 0; i < sharedUsers.length; i++) {
                    for (let j = i + 1; j < sharedUsers.length; j++) {
                        // High-risk behavioral link
                        addEdge(sharedUsers[i], sharedUsers[j], 'SHARED_IP_BEHAVIOR');
                    }
                }
            }
        }

        // Layout is now handled by frontend force-directed physics engine
        const finalNodes = nodes.map((n, i) => ({
            ...n,
            // Provide better initial organic spread based on node types
            x: 400 + Math.cos(i * 1.5) * (n.type === 'evidence' ? 100 : n.type === 'user' ? 250 : n.type === 'ip' ? 400 : 350),
            y: 400 + Math.sin(i * 1.5) * (n.type === 'evidence' ? 100 : n.type === 'user' ? 250 : n.type === 'ip' ? 400 : 350),
        }));

        return { nodes: finalNodes, edges };
    }
}

export const graphService = new GraphService();
