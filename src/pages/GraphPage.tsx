import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Share2, FileText, User, FolderOpen, AlertTriangle, ZoomIn, ZoomOut, RefreshCw, Maximize, Minimize, Crosshair } from 'lucide-react';
import { useGraphData } from '@/hooks/use-api';
import { cn } from '@/lib/utils';

const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

// ── Static Deterministic Physics Engine ────────────────────────
const calculateStaticLayout = (rawNodes: any[], rawEdges: any[], width: number, height: number) => {
  const nodes = rawNodes.map((n, i) => ({
    ...n,
    x: 400 + Math.cos(i) * 300 + (Math.random() * 50 - 25),
    y: 400 + Math.sin(i) * 300 + (Math.random() * 50 - 25),
    vx: 0,
    vy: 0
  }));

  const REPULSION = 800000; // Drastically increased to push nodes far apart
  const ATTRACTION = 0.015; // Weakened attraction to allow spreading
  const CENTER_GRAVITY = 0.005; 
  const DAMPING = 0.7; // Faster clamping
  const ITERATIONS = 150; // Calculate instantly in memory
  const centerX = width / 2;
  const centerY = height / 2;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];

        // 1. Repulsion
        for (let j = 0; j < nodes.length; j++) {
            if (i === j) continue;
            const nodeB = nodes[j];
            const dx = nodeA.x - nodeB.x;
            const dy = nodeA.y - nodeB.y;
            const distSq = dx * dx + dy * dy + 1;
            const force = REPULSION / distSq;
            nodeA.vx += (dx / Math.sqrt(distSq)) * force;
            nodeA.vy += (dy / Math.sqrt(distSq)) * force;
        }

        // 2. Attraction Edge Binding
        rawEdges.forEach(edge => {
            if (edge.source === nodeA.id || edge.target === nodeA.id) {
                const otherId = edge.source === nodeA.id ? edge.target : edge.source;
                const otherNode = nodes.find(n => n.id === otherId);
                if (otherNode) {
                    const dx = otherNode.x - nodeA.x;
                    const dy = otherNode.y - nodeA.y;
                    nodeA.vx += dx * ATTRACTION;
                    nodeA.vy += dy * ATTRACTION;
                }
            }
        });

        // 3. Central Gravity
        nodeA.vx += (centerX - nodeA.x) * CENTER_GRAVITY;
        nodeA.vy += (centerY - nodeA.y) * CENTER_GRAVITY;
    }

    // Apply velocities with heavy damping to force settling
    for (let i = 0; i < nodes.length; i++) {
        nodes[i].x += nodes[i].vx;
        nodes[i].y += nodes[i].vy;
        nodes[i].vx *= DAMPING;
        nodes[i].vy *= DAMPING;
    }
  }

  return nodes;
};

export default function GraphPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);
  
  // Pan & Zoom Workspace State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const { data: graphData, isLoading, refetch } = useGraphData();

  useEffect(() => {
    if (graphData && containerRef.current) {
        setIsReady(false);
        // Offload calculation briefly to allow paint
        setTimeout(() => {
            const width = containerRef.current?.clientWidth || 1000;
            const height = containerRef.current?.clientHeight || 800;
            const calculatedNodes = calculateStaticLayout(graphData.nodes || [], graphData.edges || [], width, height);
            setNodes(calculatedNodes);
            setEdges(graphData.edges || []);
            setIsReady(true);
            setZoom(1);
            setPan({ x: 0, y: 0 });
        }, 50);
    }
  }, [graphData]);

  useEffect(() => {
      const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // ── Workspace Navigation Handlers ────────────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    // Zoom natively on scroll without requiring Ctrl
    const zoomDelta = e.deltaY > 0 ? 0.85 : 1.15; // Slightly faster scaling for native wheel
    const newZoom = Math.min(Math.max(0.15, zoom * zoomDelta), 4);
    
    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Fallbacks for clientX/Y if event propagates strangely
        const clientX = e.clientX ?? (e.nativeEvent && e.nativeEvent.clientX) ?? rect.width/2;
        const clientY = e.clientY ?? (e.nativeEvent && e.nativeEvent.clientY) ?? rect.height/2;

        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

        const newPanX = mouseX - ((mouseX - pan.x) * (newZoom / zoom));
        const newPanY = mouseY - ((mouseY - pan.y) * (newZoom / zoom));
        
        setPan({ x: newPanX, y: newPanY });
    }
    setZoom(newZoom);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
     if ((e.target as HTMLElement).closest('.grab-node')) return; // Ignore if grabbing a node
     setIsPanning(true);
     (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
     if (!isPanning) return;
     setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
     setIsPanning(false);
     (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const resetView = () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
  };

  const toggleFullscreen = async () => {
      if (!isReady || !containerRef.current) return;
      try {
          if (!document.fullscreenElement) {
              await containerRef.current.requestFullscreen();
          } else {
              if (document.exitFullscreen) await document.exitFullscreen();
          }
      } catch (err) { }
  };

  // Node Manual Drag handling
  const handleNodeDrag = (id: string, info: any) => {
      setNodes(prev => prev.map(n => {
          if (n.id === id) {
              return { ...n, x: n.x + info.delta.x / zoom, y: n.y + info.delta.y / zoom };
          }
          return n;
      }));
  };

  // ── Adjacency Focus System ──
  const isConnected = (id: string) => {
      if (!hoveredNode) return true;
      if (id === hoveredNode) return true;
      return edges.some(e => 
          (e.source === hoveredNode && e.target === id) || 
          (e.target === hoveredNode && e.source === id)
      );
  };

  const isEdgeConnected = (edge: any) => {
      if (!hoveredNode) return true;
      return edge.source === hoveredNode || edge.target === hoveredNode;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'user': return <User className="h-5 w-5" />;
      case 'evidence': return <FileText className="h-5 w-5" />;
      case 'case': return <FolderOpen className="h-5 w-5" />;
      case 'ip': return <Share2 className="h-5 w-5" />;
      default: return <Share2 className="h-5 w-5" />;
    }
  };

  const getColor = (type: string, risk?: boolean) => {
    if (risk) return 'bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
    switch (type) {
      case 'user': return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'evidence': return 'bg-violet-500/10 text-violet-500 border-violet-500/30';
      case 'case': return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      case 'ip': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
      default: return 'bg-primary/10 text-primary border-primary/30';
    }
  };

  return (
    <div className="page-container h-[calc(100vh-120px)] flex flex-col gap-4 overflow-hidden relative">
      <div className="flex items-center justify-between z-10">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: macEase }}>
          <h1 className="text-xl font-black tracking-[-0.03em] uppercase italic text-primary">Relationship Engine</h1>
          <p className="text-[12px] text-muted-foreground font-medium">
            Static Deterministic Analysis · Industry-Grade Panning & Zooming
          </p>
        </motion.div>
        
        <div className="flex items-center gap-2">
          {!isReady && <Badge variant="secondary" className="animate-pulse bg-primary/20 text-primary">Calculating Vectors...</Badge>}
          <Badge variant="outline" className="text-[10px] font-mono bg-background/50">
            {nodes.length} NODES · {edges.length} LINKS
          </Badge>
          <div className="flex items-center bg-background border border-border/40 rounded-xl overflow-hidden shadow-sm">
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r border-border/40" onClick={() => setZoom(z => Math.max(0.2, z - 0.2))}>
                 <ZoomOut className="h-3.5 w-3.5" />
             </Button>
             <span className="text-[10px] font-mono font-bold w-12 text-center text-muted-foreground">{(zoom * 100).toFixed(0)}%</span>
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-l border-border/40" onClick={() => setZoom(z => Math.min(3, z + 0.2))}>
                 <ZoomIn className="h-3.5 w-3.5" />
             </Button>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 ml-2" onClick={resetView} title="Reset View">
              <Crosshair className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 ml-1" onClick={toggleFullscreen} title="Toggle Fullscreen">
              {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-primary/5 border-primary/20 text-primary" onClick={() => refetch()}>
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <Card 
        className="mac-card flex-1 relative overflow-hidden bg-background/40 border-border/40 backdrop-blur-xl touch-none select-none" 
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
         
        {/* Infinite Grid Background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" 
             style={{ 
                 backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                 backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
                 backgroundPosition: `${pan.x}px ${pan.y}px` 
             }} 
        />

        <AnimatePresence>
          {isReady && (
            <motion.div 
               ref={workspaceRef}
               className="absolute inset-0 origin-top-left"
               style={{ x: pan.x, y: pan.y, scale: zoom }}
               initial={{ opacity: 0, filter: 'blur(10px)' }}
               animate={{ opacity: 1, filter: 'blur(0px)' }}
               transition={{ duration: 0.5, ease: macEase }}
            >
              {/* SVG Layer for Crisp Edges */}
              <svg className="absolute inset-0 w-[4000px] h-[4000px] pointer-events-none overflow-visible">
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="24" refY="3" orientation="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--primary))" opacity="0.4" />
                  </marker>
                </defs>
                {edges.map((edge, idx) => {
                  const src = nodes.find(n => n.id === edge.source);
                  const tgt = nodes.find(n => n.id === edge.target);
                  if (!src || !tgt) return null;
                  
                  // Compute clean bezier curve
                  const dx = tgt.x - src.x;
                  const dy = tgt.y - src.y;
                  const curveOffset = Math.sqrt(dx * dx + dy * dy) * 0.15; // gentle curve
                  const cx = (src.x + tgt.x) / 2 + (dy > 0 ? curveOffset : -curveOffset);
                  const cy = (src.y + tgt.y) / 2 + (dx > 0 ? -curveOffset : curveOffset);
                  
                  const isActiveEdge = isEdgeConnected(edge);

                  return (
                    <g key={`${edge.source}-${edge.target}-${idx}`} style={{ opacity: hoveredNode && !isActiveEdge ? 0.05 : 1, transition: 'opacity 0.3s' }}>
                      <path
                        d={`M ${src.x} ${src.y} Q ${cx} ${cy} ${tgt.x} ${tgt.y}`}
                        stroke="hsl(var(--primary))" strokeWidth={hoveredNode && isActiveEdge ? "2.5" : "1"} strokeOpacity={isActiveEdge && hoveredNode ? "0.6" : "0.2"} fill="none"
                        markerEnd="url(#arrowhead)"
                      />
                      <rect 
                         x={cx - 36} y={cy - 7}
                         width="72" height="14" fill="hsl(var(--background))" opacity="0.9" rx="7"
                         stroke="hsl(var(--border))" strokeWidth={hoveredNode && isActiveEdge ? "1.5" : "0.5"}
                      />
                      <text
                        x={cx} y={cy + 3}
                        fill="hsl(var(--primary))" fontSize="7" fontWeight={hoveredNode && isActiveEdge ? "900" : "600"} textAnchor="middle"
                        className="tracking-[0.05em] uppercase opacity-80 select-none"
                      >
                        {edge.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* DOM Layer for Strict Nodes */}
              {nodes.map((node) => {
                const isActiveNode = isConnected(node.id);
                return (
                 <motion.div
                  key={node.id}
                  drag
                  dragMomentum={false}
                  onDrag={(e, info) => handleNodeDrag(node.id, info)}
                  onHoverStart={() => setHoveredNode(node.id)}
                  onHoverEnd={() => setHoveredNode(null)}
                  whileHover={{ scale: 1.1, zIndex: 100 }}
                  whileDrag={{ scale: 1.15, zIndex: 100 }}
                  className="absolute flex flex-col items-center justify-center cursor-move w-32 group grab-node"
                  style={{ 
                     left: node.x - 64, top: node.y - 64, position: 'absolute',
                     opacity: hoveredNode && !isActiveNode ? 0.2 : 1,
                     filter: hoveredNode && !isActiveNode ? 'grayscale(100%) blur(1px)' : 'none',
                     transition: 'opacity 0.3s, filter 0.3s'
                  }}
                 >
                  <div className={cn(
                    'h-14 w-14 rounded-2xl border-2 flex items-center justify-center mb-2 bg-background shadow-lg transition-colors group-hover:shadow-primary/20',
                    getColor(node.type, node.risk)
                  )}>
                    {node.risk && (
                      <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 shadow-lg animate-pulse border-2 border-background">
                        <AlertTriangle className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {getIcon(node.type)}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-background/95 px-3 py-1 rounded-md border border-border/50 text-center shadow-md max-w-full truncate">
                    {node.label}
                  </span>
                 </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend Overlay - Compact Industry Grade */}
        <div className="absolute bottom-4 left-4 p-2.5 rounded-lg bg-background/85 border border-border/40 backdrop-blur-2xl flex flex-col gap-2 shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          <div className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-[0.1em] mb-0.5 border-b border-border/20 pb-1.5">Node Classification</div>
          {[
            { type: 'user', label: 'User Entity', icon: User, color: 'text-blue-500 bg-blue-500/10' },
            { type: 'evidence', label: 'Target Evidence', icon: FileText, color: 'text-violet-500 bg-violet-500/10' },
            { type: 'case', label: 'Operation Case', icon: FolderOpen, color: 'text-amber-500 bg-amber-500/10' },
            { type: 'ip', label: 'Network Origin', icon: Share2, color: 'text-emerald-500 bg-emerald-500/10' },
          ].map(l => (
            <div key={l.type} className="flex items-center gap-2.5">
              <div className={cn("p-1.5 rounded-md shrink-0", l.color)}>
                 <l.icon className="h-3 w-3" />
              </div>
              <span className="text-[10px] font-bold tracking-tight text-foreground/80">{l.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
