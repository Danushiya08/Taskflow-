import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  AlertTriangle,
  TrendingUp,
  Shield,
  Activity,
  Loader2,
  Pencil,
  Trash2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';

type RiskProbability = 'low' | 'medium' | 'high' | 'critical';
type RiskImpact = 'low' | 'medium' | 'high' | 'critical';
type RiskStatus = 'active' | 'monitoring' | 'mitigated';

interface Risk {
  _id: string;
  title: string;
  description: string;
  project: string;
  projectId?:
    | string
    | {
        _id: string;
        name: string;
      };
  probability: RiskProbability;
  impact: RiskImpact;
  status: RiskStatus;
  mitigation: string;
  owner: string;
  identifiedDate: string;
  riskScore?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface RiskStats {
  total: number;
  critical: number;
  high: number;
  mitigated: number;
  heatMap: {
    high: { low: number; medium: number; high: number };
    medium: { low: number; medium: number; high: number };
    low: { low: number; medium: number; high: number };
  };
}

interface ProjectOption {
  _id: string;
  name: string;
}

const initialForm = {
  title: '',
  description: '',
  projectId: '',
  probability: '' as RiskProbability | '',
  impact: '' as RiskImpact | '',
  status: 'active' as RiskStatus,
  mitigation: '',
  owner: '',
};

const defaultStats: RiskStats = {
  total: 0,
  critical: 0,
  high: 0,
  mitigated: 0,
  heatMap: {
    high: { low: 0, medium: 0, high: 0 },
    medium: { low: 0, medium: 0, high: 0 },
    low: { low: 0, medium: 0, high: 0 },
  },
};

export function RiskManagementPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddRiskOpen, setIsAddRiskOpen] = useState(false);
  const [isEditRiskOpen, setIsEditRiskOpen] = useState(false);
  const [riskToDelete, setRiskToDelete] = useState<Risk | null>(null);

  const [risks, setRisks] = useState<Risk[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [stats, setStats] = useState<RiskStats>(defaultStats);

  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState(initialForm);
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);

  const getRiskScore = (probability: string, impact: string) => {
    const probScores = { low: 1, medium: 2, high: 3, critical: 4 };
    const impactScores = { low: 1, medium: 2, high: 3, critical: 4 };

    return (
      (probScores[probability as keyof typeof probScores] || 0) *
      (impactScores[impact as keyof typeof impactScores] || 0)
    );
  };

  const getRiskColor = (score: number) => {
    if (score >= 9) return 'bg-red-500';
    if (score >= 6) return 'bg-orange-500';
    if (score >= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const extractProjectId = (risk: Risk) => {
    if (!risk.projectId) return '';

    if (typeof risk.projectId === 'string') {
      return risk.projectId;
    }

    if (typeof risk.projectId === 'object' && risk.projectId._id) {
      return risk.projectId._id;
    }

    return '';
  };

  const fetchRisks = async () => {
    try {
      const res = await api.get('/risks', {
        params: {
          search: searchQuery || undefined,
        },
      });

      setRisks(res.data?.data || []);
    } catch (error: any) {
      console.error('Failed to fetch risks:', error);
      toast.error(error?.response?.data?.message || 'Failed to load risks');
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/risks/stats/summary');
      setStats(res.data?.data || defaultStats);
    } catch (error: any) {
      console.error('Failed to fetch risk stats:', error);
      setStats(defaultStats);
      toast.error(error?.response?.data?.message || 'Failed to load risk stats');
    }
  };

  const fetchProjects = async () => {
    try {
      setProjectsLoading(true);
      const res = await api.get('/risks/projects/list');
      setProjects(res.data?.data || []);
    } catch (error: any) {
      console.error('Failed to fetch projects:', error);
      toast.error(error?.response?.data?.message || 'Failed to load projects');
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadPageData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRisks(), fetchStats(), fetchProjects()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchRisks();
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingRiskId(null);
  };

  const handleAddDialogOpenChange = async (open: boolean) => {
    setIsAddRiskOpen(open);

    if (open && projects.length === 0) {
      await fetchProjects();
    }

    if (!open) {
      resetForm();
    }
  };

  const handleEditDialogOpenChange = async (open: boolean) => {
    setIsEditRiskOpen(open);

    if (open && projects.length === 0) {
      await fetchProjects();
    }

    if (!open) {
      resetForm();
    }
  };

  const validateForm = () => {
    if (
      !formData.title ||
      !formData.description ||
      !formData.projectId ||
      !formData.owner ||
      !formData.probability ||
      !formData.impact ||
      !formData.mitigation
    ) {
      toast.error('Please fill in all required fields');
      return false;
    }

    return true;
  };

  const handleAddRisk = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      await api.post('/risks', {
        title: formData.title,
        description: formData.description,
        projectId: formData.projectId,
        probability: formData.probability,
        impact: formData.impact,
        status: formData.status,
        mitigation: formData.mitigation,
        owner: formData.owner,
      });

      toast.success('Risk added successfully');
      setIsAddRiskOpen(false);
      resetForm();
      await loadPageData();
    } catch (error: any) {
      console.error('Failed to add risk:', error);
      toast.error(error?.response?.data?.message || 'Failed to add risk');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = async (risk: Risk) => {
    if (projects.length === 0) {
      await fetchProjects();
    }

    const resolvedProjectId = extractProjectId(risk);

    setEditingRiskId(risk._id);
    setFormData({
      title: risk.title,
      description: risk.description,
      projectId: resolvedProjectId,
      probability: risk.probability,
      impact: risk.impact,
      status: risk.status,
      mitigation: risk.mitigation,
      owner: risk.owner,
    });
    setIsEditRiskOpen(true);
  };

  const handleUpdateRisk = async () => {
    if (!editingRiskId) {
      toast.error('No risk selected for update');
      return;
    }

    if (!validateForm()) return;

    try {
      setUpdating(true);

      await api.put(`/risks/${editingRiskId}`, {
        title: formData.title,
        description: formData.description,
        projectId: formData.projectId,
        probability: formData.probability,
        impact: formData.impact,
        status: formData.status,
        mitigation: formData.mitigation,
        owner: formData.owner,
      });

      toast.success('Risk updated successfully');
      setIsEditRiskOpen(false);
      resetForm();
      await loadPageData();
    } catch (error: any) {
      console.error('Failed to update risk:', error);
      toast.error(error?.response?.data?.message || 'Failed to update risk');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteRisk = async () => {
    if (!riskToDelete?._id) return;

    try {
      setDeleting(true);
      await api.delete(`/risks/${riskToDelete._id}`);
      toast.success('Risk deleted successfully');
      setRiskToDelete(null);
      await loadPageData();
    } catch (error: any) {
      console.error('Failed to delete risk:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete risk');
    } finally {
      setDeleting(false);
    }
  };

  const filteredRisks = useMemo(() => {
    return risks.filter((risk) =>
      risk.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      risk.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      risk.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
      risk.owner.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [risks, searchQuery]);

  const renderRiskForm = (mode: 'add' | 'edit') => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor={`${mode}-risk-title`}>Risk Title</Label>
        <Input
          id={`${mode}-risk-title`}
          placeholder="e.g., Resource Shortage"
          value={formData.title}
          onChange={(e) => handleInputChange('title', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${mode}-risk-description`}>Description</Label>
        <Textarea
          id={`${mode}-risk-description`}
          placeholder="Describe the risk in detail..."
          rows={3}
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-risk-project`}>Project</Label>
          <Select
            value={formData.projectId}
            onValueChange={(value) => handleInputChange('projectId', value)}
            disabled={projectsLoading || projects.length === 0}
          >
            <SelectTrigger id={`${mode}-risk-project`}>
              <SelectValue
                placeholder={
                  projectsLoading
                    ? 'Loading projects...'
                    : projects.length === 0
                    ? 'No projects available'
                    : 'Select project'
                }
              />
            </SelectTrigger>

            <SelectContent>
              {projectsLoading ? (
                <SelectItem value="loading" disabled>
                  Loading projects...
                </SelectItem>
              ) : projects.length > 0 ? (
                projects.map((project) => (
                  <SelectItem key={project._id} value={project._id}>
                    {project.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-projects" disabled>
                  No projects found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${mode}-risk-owner`}>Risk Owner</Label>
          <Input
            id={`${mode}-risk-owner`}
            placeholder="Enter owner name"
            value={formData.owner}
            onChange={(e) => handleInputChange('owner', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-risk-probability`}>Probability</Label>
          <Select
            value={formData.probability}
            onValueChange={(value) => handleInputChange('probability', value)}
          >
            <SelectTrigger id={`${mode}-risk-probability`}>
              <SelectValue placeholder="Select probability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${mode}-risk-impact`}>Impact</Label>
          <Select
            value={formData.impact}
            onValueChange={(value) => handleInputChange('impact', value)}
          >
            <SelectTrigger id={`${mode}-risk-impact`}>
              <SelectValue placeholder="Select impact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${mode}-risk-status`}>Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => handleInputChange('status', value)}
          >
            <SelectTrigger id={`${mode}-risk-status`}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="monitoring">Monitoring</SelectItem>
              <SelectItem value="mitigated">Mitigated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${mode}-risk-mitigation`}>Mitigation Strategy</Label>
        <Textarea
          id={`${mode}-risk-mitigation`}
          placeholder="How will you address this risk?"
          rows={3}
          value={formData.mitigation}
          onChange={(e) => handleInputChange('mitigation', e.target.value)}
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading risk management data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Risk Management</h1>
          <p className="text-gray-600">Identify, assess, and mitigate project risks</p>
        </div>

        <Dialog open={isAddRiskOpen} onOpenChange={handleAddDialogOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Risk
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Identify New Risk</DialogTitle>
              <DialogDescription>
                Document a potential risk and its mitigation strategy
              </DialogDescription>
            </DialogHeader>

            {renderRiskForm('add')}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddRiskOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>

              <Button
                onClick={handleAddRisk}
                disabled={submitting || projectsLoading || projects.length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Risk'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditRiskOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Risk</DialogTitle>
            <DialogDescription>
              Update the selected risk details
            </DialogDescription>
          </DialogHeader>

          {renderRiskForm('edit')}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditRiskOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>

            <Button
              onClick={handleUpdateRisk}
              disabled={updating || projectsLoading || projects.length === 0}
            >
              {updating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Risk'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!riskToDelete} onOpenChange={(open) => !open && setRiskToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Risk</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this risk? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border p-4 bg-gray-50">
            <p className="font-medium text-gray-900">{riskToDelete?.title}</p>
            <p className="text-sm text-gray-600 mt-1">{riskToDelete?.project}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRiskToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRisk} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Risks</p>
                <p className="text-2xl text-gray-900 mt-1">{stats.total}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Critical Risks</p>
                <p className="text-2xl text-gray-900 mt-1">{stats.critical}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">High Priority</p>
                <p className="text-2xl text-gray-900 mt-1">{stats.high}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Mitigated</p>
                <p className="text-2xl text-gray-900 mt-1">{stats.mitigated}</p>
              </div>
              <Shield className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk Heat Map</CardTitle>
          <CardDescription>Visual representation of risk probability vs impact</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            <div></div>
            <div className="text-center text-sm text-gray-600">Low Impact</div>
            <div className="text-center text-sm text-gray-600">Medium Impact</div>
            <div className="text-center text-sm text-gray-600">High Impact</div>

            <div className="text-sm text-gray-600 flex items-center">High Prob.</div>
            <div className="h-20 bg-yellow-200 border border-gray-300 rounded flex items-center justify-center text-sm">
              {stats.heatMap.high.low}
            </div>
            <div className="h-20 bg-orange-300 border border-gray-300 rounded flex items-center justify-center text-sm">
              {stats.heatMap.high.medium}
            </div>
            <div className="h-20 bg-red-400 border border-gray-300 rounded flex items-center justify-center text-sm text-white">
              {stats.heatMap.high.high}
            </div>

            <div className="text-sm text-gray-600 flex items-center">Med. Prob.</div>
            <div className="h-20 bg-green-200 border border-gray-300 rounded flex items-center justify-center text-sm">
              {stats.heatMap.medium.low}
            </div>
            <div className="h-20 bg-yellow-300 border border-gray-300 rounded flex items-center justify-center text-sm">
              {stats.heatMap.medium.medium}
            </div>
            <div className="h-20 bg-orange-400 border border-gray-300 rounded flex items-center justify-center text-sm">
              {stats.heatMap.medium.high}
            </div>

            <div className="text-sm text-gray-600 flex items-center">Low Prob.</div>
            <div className="h-20 bg-green-300 border border-gray-300 rounded flex items-center justify-center text-sm">
              {stats.heatMap.low.low}
            </div>
            <div className="h-20 bg-green-200 border border-gray-300 rounded flex items-center justify-center text-sm">
              {stats.heatMap.low.medium}
            </div>
            <div className="h-20 bg-yellow-200 border border-gray-300 rounded flex items-center justify-center text-sm">
              {stats.heatMap.low.high}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="search"
          placeholder="Search risks..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filteredRisks.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">
              No risks found.
            </CardContent>
          </Card>
        ) : (
          filteredRisks.map((risk) => {
            const riskScore = risk.riskScore ?? getRiskScore(risk.probability, risk.impact);
            const colorClass = getRiskColor(riskScore);

            return (
              <Card key={risk._id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-2 h-full rounded-full ${colorClass} flex-shrink-0`} />

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2 gap-4">
                        <div>
                          <h3 className="text-lg text-gray-900 mb-1">{risk.title}</h3>
                          <p className="text-sm text-gray-600">{risk.description}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              risk.status === 'mitigated'
                                ? 'default'
                                : risk.status === 'monitoring'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {risk.status}
                          </Badge>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(risk)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setRiskToDelete(risk)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4 text-sm">
                        <div>
                          <span className="text-gray-500">Project:</span>
                          <p className="text-gray-900">{risk.project}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Owner:</span>
                          <p className="text-gray-900">{risk.owner}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Probability:</span>
                          <p className="text-gray-900 capitalize">{risk.probability}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Impact:</span>
                          <p className="text-gray-900 capitalize">{risk.impact}</p>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h4 className="text-sm text-blue-900 mb-1">Mitigation Strategy:</h4>
                        <p className="text-sm text-blue-800">{risk.mitigation}</p>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Risk Score:</span>
                          <Badge variant="outline">{riskScore}/16</Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          Identified:{' '}
                          {risk.identifiedDate
                            ? new Date(risk.identifiedDate).toISOString().split('T')[0]
                            : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}