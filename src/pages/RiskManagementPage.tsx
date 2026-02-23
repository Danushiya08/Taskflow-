import { useState } from 'react';
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
  Activity
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function RiskManagementPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddRiskOpen, setIsAddRiskOpen] = useState(false);

  const risks = [
    {
      id: 1,
      title: 'Resource Shortage',
      description: 'Insufficient developers for Q1 deadlines due to leave requests',
      project: 'Mobile App Redesign',
      probability: 'high',
      impact: 'high',
      status: 'active',
      mitigation: 'Hire 2 contract developers, redistribute workload',
      owner: 'Sarah Chen',
      identifiedDate: '2025-12-05'
    },
    {
      id: 2,
      title: 'Third-Party API Dependency',
      description: 'External API may have breaking changes in upcoming version',
      project: 'API Integration',
      probability: 'medium',
      impact: 'high',
      status: 'active',
      mitigation: 'Build abstraction layer, maintain fallback options',
      owner: 'Alex Johnson',
      identifiedDate: '2025-12-08'
    },
    {
      id: 3,
      title: 'Budget Overrun',
      description: 'Marketing campaign costs exceeding allocated budget',
      project: 'Marketing Campaign Q1',
      probability: 'medium',
      impact: 'medium',
      status: 'monitoring',
      mitigation: 'Review and optimize ad spending, negotiate vendor contracts',
      owner: 'Emily Davis',
      identifiedDate: '2025-12-01'
    },
    {
      id: 4,
      title: 'Technology Obsolescence',
      description: 'Current framework version reaching end of support',
      project: 'Website Migration',
      probability: 'low',
      impact: 'high',
      status: 'mitigated',
      mitigation: 'Planned upgrade to latest LTS version in Q1 2026',
      owner: 'Mike Johnson',
      identifiedDate: '2025-11-20'
    },
    {
      id: 5,
      title: 'Data Migration Errors',
      description: 'Risk of data loss during database migration',
      project: 'Database Optimization',
      probability: 'low',
      impact: 'critical',
      status: 'active',
      mitigation: 'Complete backup strategy, staged migration with rollback plan',
      owner: 'David Lee',
      identifiedDate: '2025-12-10'
    },
    {
      id: 6,
      title: 'Security Vulnerabilities',
      description: 'Potential security gaps identified in code review',
      project: 'Security Audit',
      probability: 'medium',
      impact: 'critical',
      status: 'active',
      mitigation: 'Immediate security patches, penetration testing scheduled',
      owner: 'Sarah Chen',
      identifiedDate: '2025-12-12'
    }
  ];

  const handleAddRisk = () => {
    toast.success('Risk added successfully!');
    setIsAddRiskOpen(false);
  };

  const filteredRisks = risks.filter(risk =>
    risk.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    risk.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    risk.project.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRiskScore = (probability: string, impact: string) => {
    const probScores = { low: 1, medium: 2, high: 3, critical: 4 };
    const impactScores = { low: 1, medium: 2, high: 3, critical: 4 };
    return (probScores[probability as keyof typeof probScores] || 0) * 
           (impactScores[impact as keyof typeof impactScores] || 0);
  };

  const getRiskColor = (score: number) => {
    if (score >= 9) return 'bg-red-500';
    if (score >= 6) return 'bg-orange-500';
    if (score >= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const stats = {
    total: risks.length,
    critical: risks.filter(r => getRiskScore(r.probability, r.impact) >= 9).length,
    high: risks.filter(r => getRiskScore(r.probability, r.impact) >= 6 && getRiskScore(r.probability, r.impact) < 9).length,
    mitigated: risks.filter(r => r.status === 'mitigated').length
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Risk Management</h1>
          <p className="text-gray-600">Identify, assess, and mitigate project risks</p>
        </div>
        <Dialog open={isAddRiskOpen} onOpenChange={setIsAddRiskOpen}>
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
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="risk-title">Risk Title</Label>
                <Input id="risk-title" placeholder="e.g., Resource Shortage" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-description">Description</Label>
                <Textarea id="risk-description" placeholder="Describe the risk in detail..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="risk-project">Project</Label>
                  <Select>
                    <SelectTrigger id="risk-project">
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
                  <Label htmlFor="risk-owner">Risk Owner</Label>
                  <Select>
                    <SelectTrigger id="risk-owner">
                      <SelectValue placeholder="Assign owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sarah">Sarah Chen</SelectItem>
                      <SelectItem value="mike">Mike Johnson</SelectItem>
                      <SelectItem value="emily">Emily Davis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="risk-probability">Probability</Label>
                  <Select>
                    <SelectTrigger id="risk-probability">
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
                  <Label htmlFor="risk-impact">Impact</Label>
                  <Select>
                    <SelectTrigger id="risk-impact">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-mitigation">Mitigation Strategy</Label>
                <Textarea id="risk-mitigation" placeholder="How will you address this risk?" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddRiskOpen(false)}>Cancel</Button>
              <Button onClick={handleAddRisk}>Add Risk</Button>
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

      {/* Risk Heat Map */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Heat Map</CardTitle>
          <CardDescription>Visual representation of risk probability vs impact</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {/* Headers */}
            <div></div>
            <div className="text-center text-sm text-gray-600">Low Impact</div>
            <div className="text-center text-sm text-gray-600">Medium Impact</div>
            <div className="text-center text-sm text-gray-600">High Impact</div>
            
            {/* High Probability */}
            <div className="text-sm text-gray-600 flex items-center">High Prob.</div>
            <div className="h-20 bg-yellow-200 border border-gray-300 rounded flex items-center justify-center text-sm">
              {risks.filter(r => r.probability === 'high' && r.impact === 'low').length}
            </div>
            <div className="h-20 bg-orange-300 border border-gray-300 rounded flex items-center justify-center text-sm">
              {risks.filter(r => r.probability === 'high' && r.impact === 'medium').length}
            </div>
            <div className="h-20 bg-red-400 border border-gray-300 rounded flex items-center justify-center text-sm text-white">
              {risks.filter(r => r.probability === 'high' && (r.impact === 'high' || r.impact === 'critical')).length}
            </div>

            {/* Medium Probability */}
            <div className="text-sm text-gray-600 flex items-center">Med. Prob.</div>
            <div className="h-20 bg-green-200 border border-gray-300 rounded flex items-center justify-center text-sm">
              {risks.filter(r => r.probability === 'medium' && r.impact === 'low').length}
            </div>
            <div className="h-20 bg-yellow-300 border border-gray-300 rounded flex items-center justify-center text-sm">
              {risks.filter(r => r.probability === 'medium' && r.impact === 'medium').length}
            </div>
            <div className="h-20 bg-orange-400 border border-gray-300 rounded flex items-center justify-center text-sm">
              {risks.filter(r => r.probability === 'medium' && (r.impact === 'high' || r.impact === 'critical')).length}
            </div>

            {/* Low Probability */}
            <div className="text-sm text-gray-600 flex items-center">Low Prob.</div>
            <div className="h-20 bg-green-300 border border-gray-300 rounded flex items-center justify-center text-sm">
              {risks.filter(r => r.probability === 'low' && r.impact === 'low').length}
            </div>
            <div className="h-20 bg-green-200 border border-gray-300 rounded flex items-center justify-center text-sm">
              {risks.filter(r => r.probability === 'low' && r.impact === 'medium').length}
            </div>
            <div className="h-20 bg-yellow-200 border border-gray-300 rounded flex items-center justify-center text-sm">
              {risks.filter(r => r.probability === 'low' && (r.impact === 'high' || r.impact === 'critical')).length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
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

      {/* Risk List */}
      <div className="space-y-4">
        {filteredRisks.map((risk) => {
          const riskScore = getRiskScore(risk.probability, risk.impact);
          const colorClass = getRiskColor(riskScore);
          
          return (
            <Card key={risk.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`w-2 h-full rounded-full ${colorClass} flex-shrink-0`}></div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg text-gray-900 mb-1">{risk.title}</h3>
                        <p className="text-sm text-gray-600">{risk.description}</p>
                      </div>
                      <Badge variant={risk.status === 'mitigated' ? 'default' : risk.status === 'monitoring' ? 'secondary' : 'destructive'}>
                        {risk.status}
                      </Badge>
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
                        Identified: {risk.identifiedDate}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}     