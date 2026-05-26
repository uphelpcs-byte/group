import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Trash2, Check, Calendar, Clock, MapPin, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: string;
  created_by: string;
};

type MeetingDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting | null;
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  in_progress: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const statusLabels: Record<string, string> = {
  scheduled: '예정',
  in_progress: '진행중',
  completed: '완료',
  cancelled: '취소',
};

export function MeetingDetailDialog({ open, onOpenChange, meeting }: MeetingDetailDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('agenda');
  const [newAgendaItem, setNewAgendaItem] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newActionItem, setNewActionItem] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState('none');
  const [newActionDueDate, setNewActionDueDate] = useState('');

  // Fetch agendas
  const { data: agendas = [] } = useQuery({
    queryKey: ['meeting-agendas', meeting?.id],
    queryFn: async () => {
      if (!meeting) return [];
      const { data, error } = await supabase
        .from('meeting_agendas')
        .select('*')
        .eq('meeting_id', meeting.id)
        .order('item_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!meeting,
  });

  // Fetch notes
  const { data: notes = [] } = useQuery({
    queryKey: ['meeting-notes', meeting?.id],
    queryFn: async () => {
      if (!meeting) return [];
      const { data, error } = await supabase
        .from('meeting_notes')
        .select('*, profiles:created_by(full_name, email)')
        .eq('meeting_id', meeting.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!meeting,
  });

  // Fetch action items
  const { data: actionItems = [] } = useQuery({
    queryKey: ['meeting-action-items', meeting?.id],
    queryFn: async () => {
      if (!meeting) return [];
      const { data, error } = await supabase
        .from('meeting_action_items')
        .select('*, profiles:assignee_id(full_name, email)')
        .eq('meeting_id', meeting.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!meeting,
  });

  // Fetch profiles for assignee selection
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email');
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const addAgendaMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('meeting_agendas').insert({
        meeting_id: meeting!.id,
        content,
        item_order: agendas.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-agendas', meeting?.id] });
      setNewAgendaItem('');
      toast.success('아젠다가 추가되었습니다');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteAgendaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meeting_agendas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-agendas', meeting?.id] });
      toast.success('아젠다가 삭제되었습니다');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('meeting_notes').insert({
        meeting_id: meeting!.id,
        content,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-notes', meeting?.id] });
      setNewNote('');
      toast.success('회의록이 추가되었습니다');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meeting_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-notes', meeting?.id] });
      toast.success('회의록이 삭제되었습니다');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const addActionItemMutation = useMutation({
    mutationFn: async ({ content, assigneeId, dueDate }: { content: string; assigneeId: string | null; dueDate: string | null }) => {
      const { error } = await supabase.from('meeting_action_items').insert({
        meeting_id: meeting!.id,
        content,
        assignee_id: assigneeId,
        due_date: dueDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-action-items', meeting?.id] });
      setNewActionItem('');
      setNewActionAssignee('none');
      setNewActionDueDate('');
      toast.success('액션아이템이 추가되었습니다');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const toggleActionItemMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from('meeting_action_items')
        .update({ 
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-action-items', meeting?.id] });
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteActionItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meeting_action_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-action-items', meeting?.id] });
      toast.success('액션아이템이 삭제되었습니다');
    },
    onError: (error: any) => toast.error(error.message),
  });

  if (!meeting) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{meeting.title}</DialogTitle>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(meeting.meeting_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {meeting.start_time.slice(0, 5)}
                  {meeting.end_time && ` - ${meeting.end_time.slice(0, 5)}`}
                </div>
                {meeting.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {meeting.location}
                  </div>
                )}
              </div>
            </div>
            <Badge variant="outline" className={statusColors[meeting.status]}>
              {statusLabels[meeting.status]}
            </Badge>
          </div>
          {meeting.description && (
            <p className="text-sm text-muted-foreground mt-2">{meeting.description}</p>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="agenda">아젠다 ({agendas.length})</TabsTrigger>
            <TabsTrigger value="notes">회의록 ({notes.length})</TabsTrigger>
            <TabsTrigger value="actions">액션아이템 ({actionItems.length})</TabsTrigger>
          </TabsList>

          {/* Agenda Tab */}
          <TabsContent value="agenda" className="space-y-4">
            <ScrollArea className="h-[300px] pr-4">
              {agendas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  등록된 아젠다가 없습니다
                </p>
              ) : (
                <div className="space-y-2">
                  {agendas.map((agenda, index) => (
                    <div key={agenda.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <span className="flex-1 text-sm">{agenda.content}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteAgendaMutation.mutate(agenda.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="flex gap-2">
              <Input
                placeholder="새 아젠다 항목 추가..."
                value={newAgendaItem}
                onChange={(e) => setNewAgendaItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newAgendaItem.trim()) {
                    e.preventDefault();
                    addAgendaMutation.mutate(newAgendaItem.trim());
                  }
                }}
              />
              <Button 
                onClick={() => newAgendaItem.trim() && addAgendaMutation.mutate(newAgendaItem.trim())}
                disabled={!newAgendaItem.trim() || addAgendaMutation.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4">
            <ScrollArea className="h-[300px] pr-4">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  작성된 회의록이 없습니다
                </p>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="p-4 bg-muted/50 rounded-lg group">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{(note.profiles as any)?.full_name || (note.profiles as any)?.email}</span>
                        <span>·</span>
                        <span>{format(parseISO(note.created_at), 'M월 d일 HH:mm', { locale: ko })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="space-y-2">
              <Textarea
                placeholder="회의록을 작성해주세요..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
              />
              <Button 
                onClick={() => newNote.trim() && addNoteMutation.mutate(newNote.trim())}
                disabled={!newNote.trim() || addNoteMutation.isPending}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                회의록 추가
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <ScrollArea className="h-[300px] pr-4">
              {actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  등록된 액션아이템이 없습니다
                </p>
              ) : (
                <div className="space-y-1">
                  {/* Table Header */}
                  <div className="grid grid-cols-[24px_1fr_120px_100px_32px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                    <div></div>
                    <div>내용</div>
                    <div>담당자</div>
                    <div>마감일</div>
                    <div></div>
                  </div>
                  {/* Table Body */}
                  {actionItems.map((item) => (
                    <div 
                      key={item.id} 
                      className={`grid grid-cols-[24px_1fr_120px_100px_32px] gap-2 items-center px-3 py-2 rounded-lg group ${
                        item.is_completed ? 'bg-green-500/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={item.is_completed}
                        onCheckedChange={(checked) => 
                          toggleActionItemMutation.mutate({ id: item.id, isCompleted: !!checked })
                        }
                      />
                      <p className={`text-sm truncate ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.content}
                      </p>
                      <span className="text-sm text-muted-foreground truncate">
                        {item.profiles ? ((item.profiles as any)?.full_name || (item.profiles as any)?.email) : '-'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.due_date ? format(parseISO(item.due_date), 'M/d', { locale: ko }) : '-'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteActionItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="space-y-3 border-t pt-4">
              <div className="grid grid-cols-[1fr_150px_120px] gap-2">
                <Input
                  placeholder="새 액션아이템 내용..."
                  value={newActionItem}
                  onChange={(e) => setNewActionItem(e.target.value)}
                />
                <Select value={newActionAssignee} onValueChange={setNewActionAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="담당자" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">담당자 없음</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name || profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={newActionDueDate}
                  onChange={(e) => setNewActionDueDate(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => {
                  if (newActionItem.trim()) {
                    addActionItemMutation.mutate({
                      content: newActionItem.trim(),
                      assigneeId: newActionAssignee === 'none' ? null : newActionAssignee,
                      dueDate: newActionDueDate || null,
                    });
                  }
                }}
                disabled={!newActionItem.trim() || addActionItemMutation.isPending}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                액션아이템 추가
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
