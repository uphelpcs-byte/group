import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Rocket, Calendar, Building2, ChevronRight, Trash2, Pencil, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// 기본 워크플로우 템플릿
const DEFAULT_CHECKPOINTS = [
  { phase: '1~3일차: 모니터링', checkpoint_order: 1, title: '모니터링 및 CS응대 방향 내부 룰 모니터링', description: '기존 CS 응대 패턴 분석 및 내부 규칙 파악' },
  { phase: '1~3일차: 모니터링', checkpoint_order: 2, title: '문의유형 taxonomy(태그 체계) 1차안', description: '문의 유형 분류 체계 초안 작성' },
  { phase: '1~3일차: 모니터링', checkpoint_order: 3, title: '에스컬레이션 기준/승인 플로우 초안', description: '환불/클레임 등 에스컬레이션 기준 및 승인 프로세스 초안' },
  { phase: '1~3일차: 모니터링', checkpoint_order: 4, title: '톤&매너 + 기본 템플릿 초안', description: '응대 톤앤매너 가이드 및 기본 응대 템플릿 초안' },
  { phase: '1~3일차: 모니터링', checkpoint_order: 5, title: '채널톡 자동화 후보 리스트/우선순위', description: '자동화 가능 항목 후보 리스트 및 우선순위, 요건정의(개발 전 단계)' },
  { phase: '4일차~: CS 운영', checkpoint_order: 6, title: '채널톡 채팅 상담 진행', description: '실제 채팅 상담 업무 수행' },
  { phase: '4일차~: CS 운영', checkpoint_order: 7, title: 'VOC 수집 및 분석', description: '고객 의견 수집 및 데이터 분석' },
  { phase: '서비스 종료', checkpoint_order: 8, title: 'VOC 기반 CS/CX 방향성 데이터 제공', description: 'VOC를 기반으로 앞으로의 CS/CX 방향성에 대한 데이터 정리' },
  { phase: '서비스 종료', checkpoint_order: 9, title: '최종 기획안 제공', description: 'VOC 분석 결과 및 개선 방향 기획안 제공' },
];

const PHASE_OPTIONS = [
  '1~3일차: 모니터링',
  '4일차~: CS 운영',
  '서비스 종료',
];

interface Client {
  id: string;
  name: string;
}

interface Checkpoint {
  id: string;
  pilot_id: string;
  phase: string;
  checkpoint_order: number;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
}

interface PilotProject {
  id: string;
  client_id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  clients: { name: string };
  checkpoints: Checkpoint[];
}

export default function Pilots() {
  const { user, isManagerPlus } = useAuth();
  const [pilots, setPilots] = useState<PilotProject[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  // Checkpoint editing state
  const [checkpointDialogOpen, setCheckpointDialogOpen] = useState(false);
  const [editingCheckpoint, setEditingCheckpoint] = useState<Checkpoint | null>(null);
  const [currentPilotId, setCurrentPilotId] = useState<string | null>(null);
  const [checkpointForm, setCheckpointForm] = useState({
    phase: '',
    title: '',
    description: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pilotsRes, clientsRes] = await Promise.all([
        supabase
          .from('pilot_projects')
          .select(`
            *,
            clients (name),
            checkpoints:pilot_checkpoints (*)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('clients')
          .select('id, name')
          .order('name')
      ]);

      if (pilotsRes.error) throw pilotsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      setPilots(pilotsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error: any) {
      toast.error('데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const createPilot = async () => {
    if (!selectedClient) {
      toast.error('고객사를 선택해주세요');
      return;
    }

    try {
      const { data: pilot, error: pilotError } = await supabase
        .from('pilot_projects')
        .insert({
          client_id: selectedClient,
          start_date: startDate,
          notes: notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (pilotError) throw pilotError;

      const checkpoints = DEFAULT_CHECKPOINTS.map(cp => ({
        pilot_id: pilot.id,
        phase: cp.phase,
        checkpoint_order: cp.checkpoint_order,
        title: cp.title,
        description: cp.description,
      }));

      const { error: checkpointsError } = await supabase
        .from('pilot_checkpoints')
        .insert(checkpoints);

      if (checkpointsError) throw checkpointsError;

      toast.success('파일럿 프로젝트가 생성되었습니다');
      setDialogOpen(false);
      setSelectedClient('');
      setNotes('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || '생성에 실패했습니다');
    }
  };

  const toggleCheckpoint = async (checkpoint: Checkpoint) => {
    try {
      const newCompleted = !checkpoint.is_completed;
      const { error } = await supabase
        .from('pilot_checkpoints')
        .update({
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          completed_by: newCompleted ? user?.id : null,
        })
        .eq('id', checkpoint.id);

      if (error) throw error;

      setPilots(prev => prev.map(pilot => ({
        ...pilot,
        checkpoints: pilot.checkpoints.map(cp =>
          cp.id === checkpoint.id
            ? { ...cp, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
            : cp
        )
      })));

      const pilot = pilots.find(p => p.id === checkpoint.pilot_id);
      if (pilot) {
        const allCompleted = pilot.checkpoints.every(cp => 
          cp.id === checkpoint.id ? newCompleted : cp.is_completed
        );
        
        if (allCompleted && newCompleted) {
          await supabase
            .from('pilot_projects')
            .update({ status: 'completed', end_date: format(new Date(), 'yyyy-MM-dd') })
            .eq('id', checkpoint.pilot_id);
          
          toast.success('🎉 파일럿 프로젝트가 완료되었습니다! 결과 보고서를 다운로드할 수 있습니다.');
          fetchData();
          
          // Auto-generate report on completion
          const updatedPilot = { 
            ...pilot, 
            status: 'completed',
            end_date: format(new Date(), 'yyyy-MM-dd'),
            checkpoints: pilot.checkpoints.map(cp =>
              cp.id === checkpoint.id
                ? { ...cp, is_completed: true, completed_at: new Date().toISOString() }
                : cp
            )
          };
          generatePilotReport(updatedPilot);
        }
      }
    } catch (error: any) {
      toast.error('업데이트에 실패했습니다');
    }
  };

  const generatePilotReport = (pilot: PilotProject) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(20);
    doc.text('파일럿 프로젝트 결과 보고서', pageWidth / 2, 25, { align: 'center' });
    
    // Client info
    doc.setFontSize(12);
    doc.text(`고객사: ${pilot.clients.name}`, 20, 45);
    doc.text(`시작일: ${format(new Date(pilot.start_date), 'yyyy년 M월 d일', { locale: ko })}`, 20, 55);
    doc.text(`종료일: ${pilot.end_date ? format(new Date(pilot.end_date), 'yyyy년 M월 d일', { locale: ko }) : '-'}`, 20, 65);
    doc.text(`상태: ${pilot.status === 'completed' ? '완료' : pilot.status}`, 20, 75);
    
    const progress = getProgress(pilot.checkpoints);
    doc.text(`진행률: ${progress}%`, 20, 85);
    
    if (pilot.notes) {
      doc.text(`메모: ${pilot.notes}`, 20, 95);
    }
    
    // Checkpoints table
    doc.setFontSize(14);
    doc.text('체크포인트 진행 현황', 20, 115);
    
    const groupedCheckpoints = groupCheckpointsByPhase(pilot.checkpoints);
    let tableData: (string | null | undefined)[][] = [];
    
    Object.entries(groupedCheckpoints).forEach(([phase, checkpoints]) => {
      checkpoints.forEach((cp, idx) => {
        tableData.push([
          idx === 0 ? phase : '',
          cp.title,
          cp.is_completed ? '✓ 완료' : '미완료',
          cp.completed_at ? format(new Date(cp.completed_at), 'M/d HH:mm') : '-',
          cp.description || '-'
        ]);
      });
    });
    
    autoTable(doc, {
      startY: 120,
      head: [['단계', '항목', '상태', '완료일시', '설명']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 'auto' }
      }
    });
    
    // Summary section
    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    doc.setFontSize(14);
    doc.text('요약', 20, finalY + 15);
    
    doc.setFontSize(10);
    const completedCount = pilot.checkpoints.filter(cp => cp.is_completed).length;
    const totalCount = pilot.checkpoints.length;
    doc.text(`• 총 체크포인트: ${totalCount}개`, 25, finalY + 28);
    doc.text(`• 완료된 항목: ${completedCount}개`, 25, finalY + 38);
    doc.text(`• 미완료 항목: ${totalCount - completedCount}개`, 25, finalY + 48);
    
    // Phase summary
    doc.text('• 단계별 현황:', 25, finalY + 60);
    let offsetY = 70;
    Object.entries(groupedCheckpoints).forEach(([phase, checkpoints]) => {
      const phaseCompleted = checkpoints.filter(cp => cp.is_completed).length;
      doc.text(`  - ${phase}: ${phaseCompleted}/${checkpoints.length} 완료`, 30, finalY + offsetY);
      offsetY += 8;
    });
    
    // Footer
    doc.setFontSize(8);
    doc.text(`보고서 생성일: ${format(new Date(), 'yyyy년 M월 d일 HH:mm', { locale: ko })}`, 20, doc.internal.pageSize.getHeight() - 10);
    
    // Download
    const fileName = `파일럿_결과보고서_${pilot.clients.name}_${format(new Date(), 'yyyyMMdd')}.pdf`;
    doc.save(fileName);
    toast.success('결과 보고서가 다운로드되었습니다');
  };

  const deletePilot = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 모든 진행 데이터가 삭제됩니다.')) return;

    try {
      const { error } = await supabase
        .from('pilot_projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('파일럿 프로젝트가 삭제되었습니다');
      fetchData();
    } catch (error: any) {
      toast.error('삭제에 실패했습니다');
    }
  };

  // Checkpoint CRUD
  const openAddCheckpoint = (pilotId: string) => {
    setCurrentPilotId(pilotId);
    setEditingCheckpoint(null);
    setCheckpointForm({ phase: PHASE_OPTIONS[0], title: '', description: '' });
    setCheckpointDialogOpen(true);
  };

  const openEditCheckpoint = (checkpoint: Checkpoint) => {
    setCurrentPilotId(checkpoint.pilot_id);
    setEditingCheckpoint(checkpoint);
    setCheckpointForm({
      phase: checkpoint.phase,
      title: checkpoint.title,
      description: checkpoint.description || '',
    });
    setCheckpointDialogOpen(true);
  };

  const saveCheckpoint = async () => {
    if (!checkpointForm.title.trim()) {
      toast.error('체크포인트 제목을 입력해주세요');
      return;
    }

    try {
      if (editingCheckpoint) {
        // Update existing
        const { error } = await supabase
          .from('pilot_checkpoints')
          .update({
            phase: checkpointForm.phase,
            title: checkpointForm.title,
            description: checkpointForm.description || null,
          })
          .eq('id', editingCheckpoint.id);

        if (error) throw error;
        toast.success('체크포인트가 수정되었습니다');
      } else {
        // Create new
        const pilot = pilots.find(p => p.id === currentPilotId);
        const maxOrder = pilot?.checkpoints.reduce((max, cp) => Math.max(max, cp.checkpoint_order), 0) || 0;

        const { error } = await supabase
          .from('pilot_checkpoints')
          .insert({
            pilot_id: currentPilotId,
            phase: checkpointForm.phase,
            checkpoint_order: maxOrder + 1,
            title: checkpointForm.title,
            description: checkpointForm.description || null,
          });

        if (error) throw error;
        toast.success('체크포인트가 추가되었습니다');
      }

      setCheckpointDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || '저장에 실패했습니다');
    }
  };

  const deleteCheckpoint = async (checkpointId: string) => {
    if (!confirm('이 체크포인트를 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('pilot_checkpoints')
        .delete()
        .eq('id', checkpointId);

      if (error) throw error;
      toast.success('체크포인트가 삭제되었습니다');
      fetchData();
    } catch (error: any) {
      toast.error('삭제에 실패했습니다');
    }
  };

  const getProgress = (checkpoints: Checkpoint[]) => {
    if (!checkpoints.length) return 0;
    const completed = checkpoints.filter(cp => cp.is_completed).length;
    return Math.round((completed / checkpoints.length) * 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">대기중</Badge>;
      case 'in_progress':
        return <Badge variant="default">진행중</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">완료</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">취소됨</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const groupCheckpointsByPhase = (checkpoints: Checkpoint[]) => {
    const groups: Record<string, Checkpoint[]> = {};
    checkpoints
      .sort((a, b) => a.checkpoint_order - b.checkpoint_order)
      .forEach(cp => {
        if (!groups[cp.phase]) {
          groups[cp.phase] = [];
        }
        groups[cp.phase].push(cp);
      });
    return groups;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">로딩중...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">파일럿 진행 관리</h1>
            <p className="text-muted-foreground">고객사별 파일럿 프로젝트 진행 상황을 관리합니다</p>
          </div>
          {isManagerPlus && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  파일럿 시작
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>새 파일럿 프로젝트</DialogTitle>
                  <DialogDescription>
                    고객사에 대한 새로운 파일럿 프로젝트를 시작합니다
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>고객사 선택 *</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger>
                        <SelectValue placeholder="고객사를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>시작일</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>메모</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="파일럿에 대한 메모"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    취소
                  </Button>
                  <Button onClick={createPilot}>
                    <Rocket className="mr-2 h-4 w-4" />
                    시작하기
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Checkpoint Edit Dialog */}
        <Dialog open={checkpointDialogOpen} onOpenChange={setCheckpointDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCheckpoint ? '체크포인트 수정' : '체크포인트 추가'}</DialogTitle>
              <DialogDescription>
                워크플로우에 새로운 체크포인트를 추가하거나 수정합니다
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>단계 *</Label>
                <Select 
                  value={checkpointForm.phase} 
                  onValueChange={(v) => setCheckpointForm({...checkpointForm, phase: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="단계를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {PHASE_OPTIONS.map(phase => (
                      <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>체크포인트 제목 *</Label>
                <Input
                  value={checkpointForm.title}
                  onChange={(e) => setCheckpointForm({...checkpointForm, title: e.target.value})}
                  placeholder="예: 고객 인터뷰 진행"
                />
              </div>
              <div className="space-y-2">
                <Label>설명</Label>
                <Textarea
                  value={checkpointForm.description}
                  onChange={(e) => setCheckpointForm({...checkpointForm, description: e.target.value})}
                  placeholder="체크포인트에 대한 상세 설명"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCheckpointDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={saveCheckpoint}>
                {editingCheckpoint ? '수정' : '추가'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pilot List */}
        {pilots.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Rocket className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">진행 중인 파일럿 프로젝트가 없습니다</p>
              {isManagerPlus && (
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  첫 파일럿 시작하기
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {pilots.map(pilot => {
              const progress = getProgress(pilot.checkpoints);
              const groupedCheckpoints = groupCheckpointsByPhase(pilot.checkpoints);

              return (
                <Card key={pilot.id}>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <CardTitle className="text-lg">{pilot.clients?.name}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(pilot.start_date), 'yyyy년 M월 d일', { locale: ko })} 시작
                            {pilot.end_date && (
                              <span className="text-green-600">
                                → {format(new Date(pilot.end_date), 'M월 d일', { locale: ko })} 완료
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(pilot.status)}
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress value={progress} className="h-2" />
                          <span className="text-sm font-medium">{progress}%</span>
                        </div>
                        {pilot.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generatePilotReport(pilot)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            보고서
                          </Button>
                        )}
                        {isManagerPlus && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAddCheckpoint(pilot.id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              항목 추가
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deletePilot(pilot.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {pilot.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{pilot.notes}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" className="w-full" defaultValue={Object.keys(groupedCheckpoints)}>
                      {Object.entries(groupedCheckpoints).map(([phase, checkpoints]) => {
                        const phaseCompleted = checkpoints.filter(cp => cp.is_completed).length;
                        const phaseTotal = checkpoints.length;
                        const phaseProgress = Math.round((phaseCompleted / phaseTotal) * 100);

                        return (
                          <AccordionItem key={phase} value={phase}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-2">
                                  <ChevronRight className="h-4 w-4" />
                                  <span className="font-medium">{phase}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">
                                    {phaseCompleted}/{phaseTotal}
                                  </span>
                                  <Progress value={phaseProgress} className="w-16 h-1.5" />
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-3 pl-6">
                                {checkpoints.map(checkpoint => (
                                  <div
                                    key={checkpoint.id}
                                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors group ${
                                      checkpoint.is_completed
                                        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                                        : 'bg-muted/30 border-border'
                                    }`}
                                  >
                                    <Checkbox
                                      checked={checkpoint.is_completed}
                                      onCheckedChange={() => toggleCheckpoint(checkpoint)}
                                      disabled={!isManagerPlus}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className={`font-medium ${checkpoint.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                        {checkpoint.title}
                                      </p>
                                      {checkpoint.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {checkpoint.description}
                                        </p>
                                      )}
                                      {checkpoint.is_completed && checkpoint.completed_at && (
                                        <p className="text-xs text-green-600 mt-1">
                                          ✓ {format(new Date(checkpoint.completed_at), 'M월 d일 HH:mm', { locale: ko })} 완료
                                        </p>
                                      )}
                                    </div>
                                    {isManagerPlus && (
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => openEditCheckpoint(checkpoint)}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => deleteCheckpoint(checkpoint.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
