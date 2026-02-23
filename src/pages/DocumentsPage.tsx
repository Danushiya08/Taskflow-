import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload,
  Search,
  Filter,
  FileText,
  File,
  Image,
  MoreVertical,
  Download,
  Share2,
  Clock,
  User,
  Folder,
  Cloud
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const documents = [
    {
      id: 1,
      name: 'Project Requirements.pdf',
      type: 'PDF',
      size: '2.4 MB',
      uploadedBy: 'Sarah Chen',
      uploadedAt: '2025-12-10 14:30',
      version: 3,
      project: 'Mobile App Redesign',
      icon: FileText,
      color: 'text-red-600'
    },
    {
      id: 2,
      name: 'Design Mockups.fig',
      type: 'Figma',
      size: '8.7 MB',
      uploadedBy: 'Emily Davis',
      uploadedAt: '2025-12-12 09:15',
      version: 5,
      project: 'Website Migration',
      icon: Image,
      color: 'text-purple-600'
    },
    {
      id: 3,
      name: 'API Documentation.docx',
      type: 'Word',
      size: '1.2 MB',
      uploadedBy: 'Alex Johnson',
      uploadedAt: '2025-12-11 16:45',
      version: 2,
      project: 'API Integration',
      icon: FileText,
      color: 'text-blue-600'
    },
    {
      id: 4,
      name: 'Database Schema.sql',
      type: 'SQL',
      size: '0.5 MB',
      uploadedBy: 'David Lee',
      uploadedAt: '2025-12-09 11:20',
      version: 4,
      project: 'Database Optimization',
      icon: File,
      color: 'text-green-600'
    },
    {
      id: 5,
      name: 'Marketing Assets.zip',
      type: 'Archive',
      size: '15.3 MB',
      uploadedBy: 'Emily Davis',
      uploadedAt: '2025-12-08 13:00',
      version: 1,
      project: 'Marketing Campaign Q1',
      icon: Folder,
      color: 'text-yellow-600'
    },
    {
      id: 6,
      name: 'Security Audit Report.pdf',
      type: 'PDF',
      size: '3.8 MB',
      uploadedBy: 'Sarah Chen',
      uploadedAt: '2025-12-13 10:30',
      version: 1,
      project: 'Security Audit',
      icon: FileText,
      color: 'text-red-600'
    }
  ];

  const recentVersions = [
    {
      id: 1,
      documentName: 'Project Requirements.pdf',
      version: 3,
      updatedBy: 'Sarah Chen',
      updatedAt: '2025-12-10 14:30',
      changes: 'Updated milestone dates and deliverables'
    },
    {
      id: 2,
      documentName: 'Design Mockups.fig',
      version: 5,
      updatedBy: 'Emily Davis',
      updatedAt: '2025-12-12 09:15',
      changes: 'Added mobile responsive layouts'
    },
    {
      id: 3,
      documentName: 'API Documentation.docx',
      version: 2,
      updatedBy: 'Alex Johnson',
      updatedAt: '2025-12-11 16:45',
      changes: 'Added authentication endpoints'
    }
  ];

  const handleUpload = () => {
    toast.success('Document uploaded successfully!');
    setIsUploadDialogOpen(false);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.project.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Documents</h1>
          <p className="text-gray-600">Manage files with version control and secure sharing</p>
        </div>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload New Document</DialogTitle>
              <DialogDescription>
                Add files to your project with version tracking
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="document-file">Select File</Label>
                <Input id="document-file" type="file" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-project">Project</Label>
                <Select>
                  <SelectTrigger id="document-project">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile-app">Mobile App Redesign</SelectItem>
                    <SelectItem value="website">Website Migration</SelectItem>
                    <SelectItem value="marketing">Marketing Campaign Q1</SelectItem>
                    <SelectItem value="api">API Integration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-description">Description (Optional)</Label>
                <Input id="document-description" placeholder="What's in this document?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload}>Upload</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Documents</p>
                <p className="text-2xl text-gray-900 mt-1">{documents.length}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Storage</p>
                <p className="text-2xl text-gray-900 mt-1">31.9 MB</p>
              </div>
              <Cloud className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Versions Tracked</p>
                <p className="text-2xl text-gray-900 mt-1">16</p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Shared Files</p>
                <p className="text-2xl text-gray-900 mt-1">12</p>
              </div>
              <Share2 className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Documents</TabsTrigger>
            <TabsTrigger value="versions">Version History</TabsTrigger>
            <TabsTrigger value="cloud">Cloud Integration</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Search documents..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* All Documents Tab */}
        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {filteredDocuments.map((doc) => {
                  const Icon = doc.icon;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-3 bg-gray-50 rounded-lg ${doc.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-gray-900">{doc.name}</h4>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            <span>{doc.size}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {doc.uploadedBy}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {doc.uploadedAt}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">v{doc.version}</Badge>
                        <Badge variant="secondary">{doc.project}</Badge>
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Share2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Version History Tab */}
        <TabsContent value="versions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Version Updates</CardTitle>
              <CardDescription>Track changes and restore previous versions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentVersions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-start justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-gray-900">{version.documentName}</h4>
                        <Badge>v{version.version}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{version.changes}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {version.updatedBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {version.updatedAt}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        Restore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cloud Integration Tab */}
        <TabsContent value="cloud">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Cloud className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>Google Drive</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Connect your Google Drive to sync and manage files seamlessly
                </p>
                <Button className="w-full">Connect</Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Cloud className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>Dropbox</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Integrate with Dropbox for easy file sharing and collaboration
                </p>
                <Button className="w-full">Connect</Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Cloud className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>OneDrive</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Link your Microsoft OneDrive for centralized document management
                </p>
                <Button className="w-full">Connect</Button>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Connected Storage</CardTitle>
              <CardDescription>Manage your connected cloud storage services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Cloud className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No cloud storage services connected yet</p>
                <p className="text-sm mt-1">Connect a service above to get started</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}  