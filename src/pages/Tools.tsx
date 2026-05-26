import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface WorkTool {
  id: string;
  name: string;
  url: string | null;
  login_id: string | null;
  login_password: string | null;
  description: string | null;
  created_at: string;
}

export default function Tools() {
  const { user, isManagerPlus } = useAuth();
  const [tools, setTools] = useState<WorkTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<WorkTool | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    login_id: '',
    login_password: '',
    description: '',
  });

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const { data, error } = await supabase
        .from('work_tools')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setTools(data || []);
    } catch (error: any) {
      toast.error('툴 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('툴 이름을 입력해주세요');
      return;
    }

    try {
      if (editingTool) {
        const { error } = await supabase
          .from('work_tools')
          .update({
            name: formData.name,
            url: formData.url || null,
            login_id: formData.login_id || null,
            login_password: formData.login_password || null,
            description: formData.description || null,
          })
          .eq('id', editingTool.id);

        if (error) throw error;
        toast.success('툴 정보가 수정되었습니다');
      } else {
        const { error } = await supabase
          .from('work_tools')
          .insert({
            name: formData.name,
            url: formData.url || null,
            login_id: formData.login_id || null,
            login_password: formData.login_password || null,
            description: formData.description || null,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success('새 툴이 등록되었습니다');
      }

      setDialogOpen(false);
      resetForm();
      fetchTools();
    } catch (error: any) {
      toast.error(error.message || '저장에 실패했습니다');
    }
  };

  const handleEdit = (tool: WorkTool) => {
    setEditingTool(tool);
    setFormData({
      name: tool.name,
      url: tool.url || '',
      login_id: tool.login_id || '',
      login_password: tool.login_password || '',
      description: tool.description || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('work_tools')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('툴이 삭제되었습니다');
      fetchTools();
    } catch (error: any) {
      toast.error(error.message || '삭제에 실패했습니다');
    }
  };

  const resetForm = () => {
    setEditingTool(null);
    setFormData({
      name: '',
      url: '',
      login_id: '',
      login_password: '',
      description: '',
    });
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label}이(가) 복사되었습니다`);
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
            <h1 className="text-2xl font-bold">업무 툴 관리</h1>
            <p className="text-muted-foreground">업무에 사용하는 툴의 접속 정보를 관리합니다</p>
          </div>
          {isManagerPlus && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  툴 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingTool ? '툴 정보 수정' : '새 툴 등록'}</DialogTitle>
                    <DialogDescription>
                      업무에 사용하는 툴의 접속 정보를 입력해주세요
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">툴 이름 *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="예: Slack, Notion, Jira"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="url">접속 URL</Label>
                      <Input
                        id="url"
                        type="url"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="login_id">아이디</Label>
                        <Input
                          id="login_id"
                          value={formData.login_id}
                          onChange={(e) => setFormData({ ...formData, login_id: e.target.value })}
                          placeholder="로그인 아이디"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login_password">비밀번호</Label>
                        <Input
                          id="login_password"
                          type="password"
                          value={formData.login_password}
                          onChange={(e) => setFormData({ ...formData, login_password: e.target.value })}
                          placeholder="비밀번호"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">설명</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="툴에 대한 설명이나 사용 방법"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      취소
                    </Button>
                    <Button type="submit">
                      {editingTool ? '수정' : '등록'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Tools List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              등록된 툴 목록
            </CardTitle>
            <CardDescription>
              총 {tools.length}개의 업무 툴이 등록되어 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tools.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                등록된 업무 툴이 없습니다
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>툴 이름</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>아이디</TableHead>
                      <TableHead>비밀번호</TableHead>
                      <TableHead className="hidden md:table-cell">설명</TableHead>
                      {isManagerPlus && <TableHead className="w-24">관리</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tools.map((tool) => (
                      <TableRow key={tool.id}>
                        <TableCell className="font-medium">{tool.name}</TableCell>
                        <TableCell>
                          {tool.url ? (
                            <a
                              href={tool.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <span className="max-w-[150px] truncate">{tool.url}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {tool.login_id ? (
                            <button
                              onClick={() => copyToClipboard(tool.login_id!, '아이디')}
                              className="hover:text-primary cursor-pointer"
                            >
                              {tool.login_id}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {tool.login_password ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => copyToClipboard(tool.login_password!, '비밀번호')}
                                className="hover:text-primary cursor-pointer"
                              >
                                {visiblePasswords.has(tool.id) 
                                  ? tool.login_password 
                                  : '••••••••'}
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => togglePasswordVisibility(tool.id)}
                              >
                                {visiblePasswords.has(tool.id) ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                          {tool.description || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        {isManagerPlus && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(tool)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(tool.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
