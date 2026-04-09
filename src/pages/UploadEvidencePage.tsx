import { useState, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileSearch, X, Loader2, CheckCircle, AlertTriangle,
  Lock, Hash, FileText, Image, Video, Headphones, Eye,
  HardDrive, Shield, Cloud, FolderOpen, Trash2, UploadCloud,
} from 'lucide-react';
import { useUploadEvidence, useCases } from '@/hooks/use-api';
import { cn } from '@/lib/utils';

const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

const fileTypeMap: Record<string, { icon: typeof FileSearch; label: string; color: string; bg: string }> = {
  'image': { icon: Image, label: 'Image', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'video': { icon: Video, label: 'Video', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  'audio': { icon: Headphones, label: 'Audio', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  'application/pdf': { icon: FileText, label: 'PDF', color: 'text-red-500', bg: 'bg-red-500/10' },
  'default': { icon: FileSearch, label: 'File', color: 'text-primary', bg: 'bg-primary/10' },
};

const getFileInfo = (type: string) => {
  if (type.startsWith('image')) return fileTypeMap.image;
  if (type.startsWith('video')) return fileTypeMap.video;
  if (type.startsWith('audio')) return fileTypeMap.audio;
  if (type === 'application/pdf') return fileTypeMap['application/pdf'];
  return fileTypeMap.default;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const UploadEvidencePage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [caseId, setCaseId] = useState('');
  const [category, setCategory] = useState('other');
  const [isDrag, setIsDrag] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileHash, setFileHash] = useState<string>('');
  const [isHashing, setIsHashing] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadEvidence();
  const { data: casesData } = useCases({ limit: 100 });

  const cases = useMemo(() => {
    const list = casesData?.cases || casesData?.data?.cases || (Array.isArray(casesData) ? casesData : []);
    return Array.isArray(list) ? list : [];
  }, [casesData]);

  /**
   * Hash the file client-side for preview (SHA-256).
   */
  const hashFile = useCallback(async (f: File) => {
    setIsHashing(true);
    try {
      const buffer = await f.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setFileHash(hex);
    } catch {
      setFileHash('');
    }
    setIsHashing(false);
  }, []);

  const onFileSelect = useCallback(async (f: File) => {
    setFile(f);
    setUploadSuccess(false);
    setUploadProgress(0);

    // Auto-detect category
    if (f.type.startsWith('image')) setCategory('images');
    else if (f.type.startsWith('video')) setCategory('video');
    else if (f.type.startsWith('audio')) setCategory('audio');
    else if (f.type === 'application/pdf' || f.type.includes('document')) setCategory('documents');
    else setCategory('other');

    await hashFile(f);
  }, [hashFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDrag(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) onFileSelect(droppedFile);
  }, [onFileSelect]);

  const handleSubmit = () => {
    if (!file || !caseId) return;

    const formData = new FormData();
    formData.append('files', file);
    formData.append('case_id', caseId);
    formData.append('description', description.trim());
    formData.append('category', category);

    uploadMutation.mutate(
      {
        formData,
        onProgress: (p: number) => setUploadProgress(p),
      },
      {
        onSuccess: () => {
          setUploadSuccess(true);
          // Reset form after a delay
          setTimeout(() => {
            setFile(null);
            setDescription('');
            setCaseId('');
            setCategory('other');
            setUploadProgress(0);
            setFileHash('');
            setUploadSuccess(false);
          }, 3000);
        },
      }
    );
  };

  const removeFile = () => {
    setFile(null);
    setFileHash('');
    setUploadProgress(0);
    setUploadSuccess(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const isUploading = uploadMutation.isPending;

  return (
    <div className="page-container space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: macEase }}>
        <h1 className="text-xl font-bold tracking-[-0.02em]">Upload Evidence</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Files are hashed (SHA-256), encrypted (AES-256-GCM), and stored with full chain of custody
        </p>
      </motion.div>

      {/* Security notice */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3, ease: macEase }}
        className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
          <Shield className="h-4 w-4 text-primary" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold">End-to-End Evidence Security</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            SHA-256 integrity hash → AES-256-GCM encryption → Immutable audit log → Blockchain anchoring
          </p>
        </div>
      </motion.div>

      {/* Drop Zone */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3, ease: macEase }}>
        <Card className={cn(
          'mac-card border-2 border-dashed transition-colors',
          isDrag ? 'border-primary/50 bg-primary/[0.03]' : 'border-border/40',
          file && 'border-solid border-border/30',
        )}>
          <CardContent className="p-0">
            <AnimatePresence mode="wait">
              {!file ? (
                <motion.label
                  key="dropzone"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-12 px-6 cursor-pointer select-none"
                  htmlFor="file-input"
                  onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
                  onDragLeave={() => setIsDrag(false)}
                  onDrop={handleDrop}
                >
                  <div className={cn(
                    'flex items-center justify-center h-14 w-14 rounded-2xl mb-4 transition-colors',
                    isDrag ? 'bg-primary/15' : 'bg-muted/60'
                  )}>
                    <UploadCloud className={cn('h-6 w-6 transition-colors', isDrag ? 'text-primary' : 'text-muted-foreground/50')} strokeWidth={1.5} />
                  </div>
                  <p className="text-[14px] font-bold mb-1">
                    {isDrag ? 'Drop file here' : 'Drag & drop evidence file'}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    or <span className="text-primary font-medium cursor-pointer hover:underline">browse files</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">
                    All file types supported • Max 500MB per file
                  </p>
                  <input
                    ref={inputRef}
                    id="file-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFileSelect(f);
                    }}
                  />
                </motion.label>
              ) : (
                <motion.div
                  key="file-preview"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4"
                >
                  {/* Upload success overlay */}
                  {uploadSuccess && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center py-8"
                    >
                      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-500/15 mb-3">
                        <CheckCircle className="h-7 w-7 text-emerald-500" strokeWidth={2} />
                      </div>
                      <p className="text-[16px] font-bold text-emerald-500">Evidence Uploaded</p>
                      <p className="text-[12px] text-muted-foreground mt-1">File has been hashed, encrypted, and catalogued</p>
                    </motion.div>
                  )}

                  {!uploadSuccess && (
                    <>
                      {(() => {
                        const fInfo = getFileInfo(file.type);
                        const Icon = fInfo.icon;
                        return (
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 mb-4">
                            <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl shrink-0', fInfo.bg)}>
                              <Icon className={cn('h-5 w-5', fInfo.color)} strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold truncate">{file.name}</p>
                              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {formatBytes(file.size)}</span>
                                <span className="uppercase font-medium">{fInfo.label}</span>
                              </div>
                            </div>
                            <button onClick={removeFile} disabled={isUploading}
                              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50">
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        );
                      })()}

                      {/* Hash preview */}
                      {(isHashing || fileHash) && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/20 mb-4">
                          {isHashing ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">Computing SHA-256 hash…</span>
                            </>
                          ) : (
                            <>
                              <Hash className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">SHA-256</span>
                                <p className="text-[10px] font-mono text-foreground break-all leading-tight mt-0.5">{fileHash}</p>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Upload progress bar */}
                      {isUploading && (
                        <div className="mb-4 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-primary flex items-center gap-1.5">
                              <Lock className="h-3 w-3" /> Encrypting & Uploading…
                            </span>
                            <span className="font-bold">{uploadProgress}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-primary"
                              animate={{ width: `${uploadProgress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Upload Form */}
      {file && !uploadSuccess && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: macEase }}>
          <Card className="mac-card">
            <CardContent className="p-5 space-y-4">
              {/* Case Selection (Required) */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Link to Case <span className="text-destructive">*</span>
                </Label>
                <Select value={caseId} onValueChange={setCaseId}>
                  <SelectTrigger className={cn("h-9 text-[12px]", !caseId && "text-muted-foreground")}>
                    <SelectValue placeholder="Select a case…" />
                  </SelectTrigger>
                  <SelectContent>
                    {cases.length === 0 ? (
                      <SelectItem value="none" disabled className="px-3 py-4 text-center text-[12px] text-muted-foreground w-full">
                        <FolderOpen className="h-5 w-5 mx-auto mb-1 opacity-40 inline-flex" />
                        No cases available. Create a case first.
                      </SelectItem>
                    ) : (
                      cases.map((c: any) => (
                        <SelectItem key={c.case_id || c._id} value={c.case_id || c._id}>
                          {c.case_name || c.title || 'Untitled'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {!caseId && (
                  <p className="text-[10px] text-amber-500">Evidence must be linked to a case</p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="documents">📄 Documents</SelectItem>
                    <SelectItem value="images">🖼️ Images</SelectItem>
                    <SelectItem value="audio">🎵 Audio</SelectItem>
                    <SelectItem value="video">🎬 Video</SelectItem>
                    <SelectItem value="forensic_image">💿 Forensic Image</SelectItem>
                    <SelectItem value="logs">📋 Logs</SelectItem>
                    <SelectItem value="other">📁 Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
                <Textarea
                  placeholder="Context about this evidence, chain of custody notes, relevant observations…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="text-[13px] resize-none rounded-lg"
                  maxLength={2000}
                />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" className="text-[12px]" onClick={removeFile} disabled={isUploading}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove File
                </Button>
                <Button size="sm" className="text-[12px]" onClick={handleSubmit}
                  disabled={!caseId || isUploading || isHashing}>
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {isUploading ? 'Uploading…' : 'Upload Evidence'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {!file && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3, ease: macEase }}>
          <Card className="mac-card">
            <CardContent className="p-5">
              <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" /> Evidence Processing Pipeline
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: Hash, label: 'Hash', desc: 'SHA-256', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                  { icon: Lock, label: 'Encrypt', desc: 'AES-256-GCM', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  { icon: Cloud, label: 'Store', desc: 'Encrypted S3', color: 'text-violet-500', bg: 'bg-violet-500/10' },
                  { icon: Eye, label: 'Audit', desc: 'Immutable Log', color: 'text-amber-500', bg: 'bg-amber-500/10' },
                ].map((step) => (
                  <div key={step.label} className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/20">
                    <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg mb-2', step.bg)}>
                      <step.icon className={cn('h-3.5 w-3.5', step.color)} strokeWidth={1.8} />
                    </div>
                    <p className="text-[11px] font-bold">{step.label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default UploadEvidencePage;
