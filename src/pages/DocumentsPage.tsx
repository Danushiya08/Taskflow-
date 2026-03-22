import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Search,
  Filter,
  FileText,
  File,
  Image as ImageIcon,
  MoreVertical,
  Download,
  Share2,
  Clock,
  User as UserIcon,
  Folder,
  Cloud,
  Eye,
  RotateCcw,
  Shield,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type SystemRole = "admin" | "project-manager" | "team-member" | "client" | string;
type ProjectRole = "admin" | "project-manager" | "team-member" | "client" | null;
type DateFormatPreference = "mdy" | "dmy" | "ymd";

type Project = {
  _id: string;
  name: string;
  roleInProject?: ProjectRole;
};

type DocVersion = {
  version: number;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy?: { _id: string; name?: string; email?: string; role?: string };
  uploadedAt?: string;
  changeNote?: string;
};

type DocumentRow = {
  _id: string;
  project: string;
  title: string;
  description?: string;
  visibility: "internal" | "client";
  status: "draft" | "in-review" | "approved";
  versions: DocVersion[];
  currentVersion: number;
  createdAt?: string;
  updatedAt?: string;
};

type MeUser = {
  _id: string;
  name?: string;
  email?: string;
  role?: SystemRole;
};

function fmtBytes(n: number) {
  if (!Number.isFinite(n)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let val = n;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatDateByPreference(s?: string, dateFormat: DateFormatPreference = "mdy") {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  if (dateFormat === "dmy") return `${day}/${month}/${year}`;
  if (dateFormat === "ymd") return `${year}-${month}-${day}`;
  return `${month}/${day}/${year}`;
}

function fmtDateTimeByPreference(s?: string, dateFormat: DateFormatPreference = "mdy") {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;

  const datePart = formatDateByPreference(s, dateFormat);
  const timePart = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

function docIconByMime(mime?: string, title?: string) {
  const t = (title || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf") || t.endsWith(".pdf")) return { Icon: FileText, color: "text-red-600" };
  if (m.includes("image") || t.match(/\.(png|jpg|jpeg|webp|gif)$/)) return { Icon: ImageIcon, color: "text-purple-600" };
  if (t.match(/\.(sql|db)$/)) return { Icon: File, color: "text-green-600" };
  if (t.match(/\.(zip|rar|7z|tar|gz)$/)) return { Icon: Folder, color: "text-yellow-600" };
  if (t.match(/\.(doc|docx)$/)) return { Icon: FileText, color: "text-blue-600" };
  return { Icon: File, color: "text-muted-foreground" };
}

function normalizeRole(role?: string): SystemRole {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "admin";
  if (["project-manager", "projectmanager", "project manager", "pm"].includes(r)) return "project-manager";
  if (["team-member", "teammember", "team member", "member"].includes(r)) return "team-member";
  if (r === "client") return "client";
  return r;
}

function canUpload(projectRole: ProjectRole) {
  return projectRole === "admin" || projectRole === "project-manager" || projectRole === "team-member";
}
function canManage(projectRole: ProjectRole) {
  return projectRole === "admin" || projectRole === "project-manager";
}
function canShare(projectRole: ProjectRole) {
  return canManage(projectRole);
}
function canRestore(projectRole: ProjectRole) {
  return canManage(projectRole);
}

export function DocumentsPage() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [dateFormat, setDateFormat] = useState<DateFormatPreference>("mdy");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedVisibility, setSelectedVisibility] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProjectId, setUploadProjectId] = useState<string>("");
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadDescription, setUploadDescription] = useState<string>("");
  const [uploadVisibility, setUploadVisibility] = useState<"internal" | "client">("internal");
  const [uploadStatus, setUploadStatus] = useState<"draft" | "in-review" | "approved">("draft");
  const [uploadChangeNote, setUploadChangeNote] = useState<string>("");

  const [versionsOpen, setVersionsOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState<DocumentRow | null>(null);
  const [activeDocVersions, setActiveDocVersions] = useState<DocVersion[]>([]);
  const [activeDocCurrent, setActiveDocCurrent] = useState<number>(1);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareUserIdsText, setShareUserIdsText] = useState<string>("");

  const systemRole = normalizeRole(me?.role);
  const isAdmin = systemRole === "admin";

  const [projectRoles, setProjectRoles] = useState<Record<string, ProjectRole>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setMe(JSON.parse(raw));
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/settings/me");
        const prefs = res?.data?.preferences || {};
        setDateFormat((prefs.dateFormat as DateFormatPreference) || "mdy");
      } catch {
        setDateFormat("mdy");
      }
    })();
  }, []);

  const getProjectRole = (projectId: string): ProjectRole => {
    if (isAdmin) return "admin";
    return projectRoles[projectId] ?? null;
  };

  useEffect(() => {
    (async () => {
      setLoadingProjects(true);
      try {
        const [projRes, rolesRes] = await Promise.allSettled([api.get("/projects"), api.get("/projects/roles")]);

        if (projRes.status === "fulfilled") {
          const list: any[] = projRes.value.data?.projects || projRes.value.data || [];
          const normalized: Project[] = list.map((p) => ({
            _id: p._id,
            name: p.name || p.title || "Untitled",
            roleInProject: p.roleInProject ? (normalizeRole(p.roleInProject) as any) : undefined,
          }));
          setProjects(normalized);

          if (!uploadProjectId && normalized.length > 0) {
            const firstAllowed = normalized.find((p) => canUpload(p.roleInProject ?? null));
            setUploadProjectId(firstAllowed?._id || normalized[0]._id);
          }
        }

        if (rolesRes.status === "fulfilled") {
          const map = rolesRes.value.data?.roles || {};
          const normalizedRoles: Record<string, ProjectRole> = {};
          for (const k of Object.keys(map)) normalizedRoles[k] = normalizeRole(map[k]) as any;
          setProjectRoles(normalizedRoles);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingProjects(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      if (!projects.length) {
        setDocuments([]);
        return;
      }

      const visibility = selectedVisibility !== "all" ? selectedVisibility : undefined;
      const status = selectedStatus !== "all" ? selectedStatus : undefined;

      if (selectedProjectId !== "all") {
        const res = await api.get(`/projects/${selectedProjectId}/documents`, {
          params: { search: searchQuery || undefined, visibility, status },
        });
        setDocuments(res.data?.docs || []);
        return;
      }

      const all: DocumentRow[] = [];
      for (const p of projects) {
        try {
          const res = await api.get(`/projects/${p._id}/documents`, {
            params: { search: searchQuery || undefined, visibility, status },
          });
          all.push(...(res.data?.docs || []));
        } catch {
          // ignore inaccessible
        }
      }

      all.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      setDocuments(all);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchDocuments().catch((e) => {
        console.error(e);
        toast.error("Failed to load documents");
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedProjectId, selectedVisibility, selectedStatus, projects.length]);

  const handleUpload = async () => {
    if (!uploadProjectId) return toast.error("Select a project");
    const role = getProjectRole(uploadProjectId);
    if (!canUpload(role)) return toast.error("You don't have permission to upload to this project");
    if (!uploadFile) return toast.error("Select a file");
    if (!uploadTitle.trim()) return toast.error("Enter a document title");

    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("title", uploadTitle.trim());
      fd.append("description", uploadDescription.trim());
      fd.append("visibility", uploadVisibility);
      fd.append("status", uploadStatus);
      fd.append("changeNote", uploadChangeNote.trim());

      await api.post(`/projects/${uploadProjectId}/documents`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Document uploaded!");
      setIsUploadDialogOpen(false);

      setUploadFile(null);
      setUploadTitle("");
      setUploadDescription("");
      setUploadChangeNote("");

      await fetchDocuments();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Upload failed");
    }
  };

  const openVersions = async (doc: DocumentRow) => {
    setActiveDoc(doc);
    setVersionsOpen(true);
    setLoadingVersions(true);
    try {
      const res = await api.get(`/documents/${doc._id}/versions`);
      setActiveDocVersions(res.data?.versions || []);
      setActiveDocCurrent(res.data?.currentVersion || doc.currentVersion || 1);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load versions");
      setVersionsOpen(false);
    } finally {
      setLoadingVersions(false);
    }
  };

  const restoreVersion = async (docId: string, version: number) => {
    if (!activeDoc) return;
    const role = getProjectRole(activeDoc.project);
    if (!canRestore(role)) return toast.error("Only Admin/PM can restore versions");

    try {
      await api.post(`/documents/${docId}/restore/${version}`);
      toast.success(`Restored to v${version}`);
      await openVersions(activeDoc);
      await fetchDocuments();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Restore failed");
    }
  };

  const openShare = (doc: DocumentRow) => {
    setActiveDoc(doc);
    setShareUserIdsText("");
    setShareOpen(true);
  };

  const shareDoc = async () => {
    if (!activeDoc) return;
    const role = getProjectRole(activeDoc.project);
    if (!canShare(role)) return toast.error("Only Admin/PM can share documents");

    const userIds = shareUserIdsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!userIds.length) return toast.error("Enter at least one userId");

    try {
      await api.post(`/documents/${activeDoc._id}/share`, { userIds });
      toast.success("Document shared!");
      setShareOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Share failed");
    }
  };

  const downloadDoc = async (doc: DocumentRow) => {
    try {
      const res = await api.get(`/documents/${doc._id}/download`, { responseType: "blob" });
      const cd = res.headers?.["content-disposition"] || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      const fileName = match?.[1] || `${doc.title || "document"}`;

      const blobUrl = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Download failed");
    }
  };

  const totalVersions = useMemo(() => documents.reduce((sum, d) => sum + (d.versions?.length || 0), 0), [documents]);

  const totalStorageBytes = useMemo(() => {
    let sum = 0;
    for (const d of documents) {
      const current =
        d.versions?.find((v) => v.version === d.currentVersion) || d.versions?.[d.versions.length - 1];
      if (current?.size) sum += current.size;
    }
    return sum;
  }, [documents]);

  const sharedFilesCount = 0;

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => {
      const t = (d.title || "").toLowerCase();
      const v = (d.visibility || "").toLowerCase();
      const s = (d.status || "").toLowerCase();
      return t.includes(q) || v.includes(q) || s.includes(q);
    });
  }, [documents, searchQuery]);

  const recentVersions = useMemo(() => {
    const items: Array<{ doc: DocumentRow; v: DocVersion }> = [];
    for (const d of documents) {
      const last = d.versions?.[d.versions.length - 1];
      if (last) items.push({ doc: d, v: last });
    }
    items.sort((a, b) => new Date(b.v.uploadedAt || 0).getTime() - new Date(a.v.uploadedAt || 0).getTime());
    return items.slice(0, 10);
  }, [documents]);

  const uploadEnabled = projects.some((p) => canUpload(getProjectRole(p._id) || p.roleInProject || null));

  return (
    <div className="p-6 space-y-6 bg-background text-foreground">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Documents</h1>
          <p className="text-muted-foreground">Manage files with version control and secure sharing</p>
          {loadingProjects ? (
            <p className="text-xs text-muted-foreground mt-1">Loading your projects…</p>
          ) : !projects.length ? (
            <p className="text-xs text-red-600 mt-1">
              No accessible projects found for your account. (Fix backend: GET /api/projects must return member projects)
            </p>
          ) : null}
        </div>

        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!uploadEnabled}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>

          <DialogContent className="border-border bg-card text-card-foreground">
            <DialogHeader>
              <DialogTitle>Upload New Document</DialogTitle>
              <DialogDescription>Add files to your project with version tracking</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="document-file">Select File</Label>
                <Input id="document-file" type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="document-project">Project</Label>
                <Select value={uploadProjectId} onValueChange={(v) => setUploadProjectId(v)}>
                  <SelectTrigger id="document-project">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => {
                      const pr = getProjectRole(p._id) || p.roleInProject || null;
                      const allowed = canUpload(pr);
                      return (
                        <SelectItem key={p._id} value={p._id} disabled={!allowed}>
                          {p.name} {!allowed ? " (No upload access)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {uploadProjectId ? (
                  <p className="text-xs text-muted-foreground">
                    Your role in this project:{" "}
                    <span className="font-medium text-card-foreground">
                      {String(getProjectRole(uploadProjectId) || projects.find((p) => p._id === uploadProjectId)?.roleInProject || "no access")}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="document-title">Title</Label>
                <Input
                  id="document-title"
                  placeholder="e.g., API Documentation"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Tip: If the same title exists in the project, this will upload as a <b>new version</b>.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document-description">Description (Optional)</Label>
                <Input
                  id="document-description"
                  placeholder="What's in this document?"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select value={uploadVisibility} onValueChange={(v: any) => setUploadVisibility(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal (team only)</SelectItem>
                      <SelectItem value="client">Client-visible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={uploadStatus} onValueChange={(v: any) => setUploadStatus(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in-review">In Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document-changenote">Change Note (Optional)</Label>
                <Input
                  id="document-changenote"
                  placeholder="e.g., Updated milestone dates"
                  value={uploadChangeNote}
                  onChange={(e) => setUploadChangeNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload}>Upload</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-semibold mt-1">{documents.length}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Storage</p>
                <p className="text-2xl font-semibold mt-1">{fmtBytes(totalStorageBytes)}</p>
              </div>
              <Cloud className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Versions Tracked</p>
                <p className="text-2xl font-semibold mt-1">{totalVersions}</p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Shared Files</p>
                <p className="text-2xl font-semibold mt-1">{sharedFilesCount}</p>
              </div>
              <Share2 className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all">All Documents</TabsTrigger>
            <TabsTrigger value="versions">Version History</TabsTrigger>
            <TabsTrigger value="cloud">Cloud Integration</TabsTrigger>
          </TabsList>

          <div className="flex gap-3 items-center flex-wrap">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedVisibility} onValueChange={setSelectedVisibility}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All visibility</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="client">Client-visible</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in-review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search documents..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Button variant="outline" size="icon" title="Filters">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="all">
          <Card className="border-border bg-card text-card-foreground">
            <CardContent className="pt-6">
              {loadingDocs ? (
                <div className="py-10 text-center text-muted-foreground">Loading documents…</div>
              ) : filteredDocuments.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">No documents found.</div>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map((doc) => {
                    const current =
                      doc.versions?.find((v) => v.version === doc.currentVersion) ||
                      doc.versions?.[doc.versions.length - 1];

                    const { Icon, color } = docIconByMime(current?.mimeType, doc.title);
                    const projectName = projects.find((p) => p._id === doc.project)?.name || "Project";
                    const projectRole = getProjectRole(doc.project);

                    const showShare = canShare(projectRole);
                    const isClient = normalizeRole(me?.role) === "client";

                    return (
                      <div
                        key={doc._id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`p-3 bg-muted rounded-lg ${color}`}>
                            <Icon className="w-6 h-6" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-card-foreground font-medium truncate">{doc.title}</h4>

                              {doc.visibility === "internal" ? (
                                <Badge variant="outline" className="gap-1">
                                  <Lock className="w-3 h-3" /> Internal
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <Shield className="w-3 h-3" /> Client
                                </Badge>
                              )}

                              <Badge variant="outline">{doc.status}</Badge>
                            </div>

                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                              <span>{current ? fmtBytes(current.size) : "-"}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <UserIcon className="w-3 h-3" />
                                {current?.uploadedBy?.name || current?.uploadedBy?.email || "—"}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {fmtDateTimeByPreference(current?.uploadedAt || doc.updatedAt, dateFormat)}
                              </span>
                            </div>

                            {doc.description ? (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{doc.description}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap justify-end">
                          <Badge variant="outline">v{doc.currentVersion}</Badge>
                          <Badge variant="secondary">{projectName}</Badge>

                          <Button variant="ghost" size="icon" title="Download" onClick={() => downloadDoc(doc)}>
                            <Download className="w-4 h-4" />
                          </Button>

                          <Button variant="ghost" size="icon" title="Versions" onClick={() => openVersions(doc)}>
                            <Eye className="w-4 h-4" />
                          </Button>

                          {showShare && !isClient ? (
                            <Button variant="ghost" size="icon" title="Share" onClick={() => openShare(doc)}>
                              <Share2 className="w-4 h-4" />
                            </Button>
                          ) : null}

                          <Button variant="ghost" size="icon" title="More">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions">
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>Recent Version Updates</CardTitle>
              <CardDescription>Track changes and restore previous versions</CardDescription>
            </CardHeader>
            <CardContent>
              {recentVersions.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">No version history yet.</div>
              ) : (
                <div className="space-y-4">
                  {recentVersions.map(({ doc, v }) => {
                    const projectName = projects.find((p) => p._id === doc.project)?.name || "Project";
                    const projectRole = getProjectRole(doc.project);

                    return (
                      <div
                        key={`${doc._id}-${v.version}`}
                        className="flex items-start justify-between p-4 border border-border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="text-card-foreground font-medium">{doc.title}</h4>
                            <Badge>v{v.version}</Badge>
                            <Badge variant="secondary">{projectName}</Badge>
                            <Badge variant="outline">{doc.status}</Badge>
                          </div>

                          <p className="text-sm text-muted-foreground mb-2">
                            {v.changeNote?.trim() ? v.changeNote : "No change note provided"}
                          </p>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <UserIcon className="w-3 h-3" />
                              {v.uploadedBy?.name || v.uploadedBy?.email || "—"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {fmtDateTimeByPreference(v.uploadedAt, dateFormat)}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openVersions(doc)}>
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canRestore(projectRole)}
                            onClick={() => restoreVersion(doc._id, v.version)}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Restore
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cloud">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-border bg-card text-card-foreground hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <Cloud className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>Google Drive</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your Google Drive to sync and manage files seamlessly
                </p>
                <Button className="w-full" onClick={() => toast.info("Integrate OAuth flow here")}>
                  Connect
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <Cloud className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>Dropbox</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Integrate with Dropbox for easy file sharing and collaboration
                </p>
                <Button className="w-full" onClick={() => toast.info("Integrate OAuth flow here")}>
                  Connect
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <Cloud className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>OneDrive</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Link your Microsoft OneDrive for centralized document management
                </p>
                <Button className="w-full" onClick={() => toast.info("Integrate OAuth flow here")}>
                  Connect
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6 border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>Connected Storage</CardTitle>
              <CardDescription>Manage your connected cloud storage services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Cloud className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p>No cloud storage services connected yet</p>
                <p className="text-sm mt-1">Connect a service above to get started</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="max-w-2xl border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              {activeDoc ? (
                <span>
                  {activeDoc.title} • Current: <b>v{activeDocCurrent}</b>
                </span>
              ) : (
                "Track changes and restore previous versions"
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingVersions ? (
            <div className="py-10 text-center text-muted-foreground">Loading versions…</div>
          ) : activeDocVersions.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No versions found.</div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
              {activeDocVersions
                .slice()
                .sort((a, b) => b.version - a.version)
                .map((v) => {
                  const isCurrent = v.version === activeDocCurrent;
                  const projectRole = activeDoc ? getProjectRole(activeDoc.project) : null;

                  return (
                    <div key={v.version} className="flex items-start justify-between p-3 border border-border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={isCurrent ? "default" : "outline"}>v{v.version}</Badge>
                          {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                          <span className="text-sm text-card-foreground">{v.fileName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                          <span>{fmtBytes(v.size)}</span>
                          <span>•</span>
                          <span>{v.uploadedBy?.name || v.uploadedBy?.email || "—"}</span>
                          <span>•</span>
                          <span>{fmtDateTimeByPreference(v.uploadedAt, dateFormat)}</span>
                        </div>
                        {v.changeNote?.trim() ? <p className="text-sm text-muted-foreground mt-2">{v.changeNote}</p> : null}
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => activeDoc && downloadDoc(activeDoc)}>
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isCurrent || !canRestore(projectRole)}
                          onClick={() => activeDoc && restoreVersion(activeDoc._id, v.version)}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Share Document</DialogTitle>
            <DialogDescription>
              {activeDoc ? `Share "${activeDoc.title}" with users in the same project.` : "Share document"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>User IDs (comma separated)</Label>
              <Input
                placeholder="e.g. 65f...a1, 65f...b2"
                value={shareUserIdsText}
                onChange={(e) => setShareUserIdsText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                (Later you can replace this with a searchable dropdown of project members.)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Cancel
            </Button>
            <Button onClick={shareDoc}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}