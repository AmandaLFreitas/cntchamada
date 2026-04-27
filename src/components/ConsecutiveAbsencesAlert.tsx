import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { AlertTriangle, X, ChevronUp } from 'lucide-react';

const THRESHOLD = 4;

export function ConsecutiveAbsencesAlert() {
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const { schoolId } = useSchool();

  const { data: rows } = useQuery({
    queryKey: ['consecutive_absences_alert', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, status, date, students(full_name)')
        .eq('school_id', schoolId!)
        .in('status', ['present', 'absent'])
        .order('date', { ascending: true })
        .limit(10000);
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  const alerts = useMemo(() => {
    if (!rows) return [];
    // Group by student_id and count current consecutive absences (ignoring neutral, since we filter them out above)
    const byStudent = new Map<string, { name: string; streak: number }>();
    (rows as any[]).forEach(r => {
      const sid = r.student_id;
      const name = r.students?.full_name || 'Sem nome';
      const cur = byStudent.get(sid) || { name, streak: 0 };
      cur.name = name;
      if (r.status === 'absent') cur.streak += 1;
      else if (r.status === 'present') cur.streak = 0;
      byStudent.set(sid, cur);
    });
    const result: { id: string; name: string; streak: number }[] = [];
    byStudent.forEach((v, id) => {
      if (v.streak > THRESHOLD) result.push({ id, name: v.name, streak: v.streak });
    });
    return result.sort((a, b) => b.streak - a.streak);
  }, [rows]);

  if (alerts.length === 0 || dismissed) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-36 z-50 bg-destructive text-destructive-foreground rounded-full p-3 shadow-lg hover:bg-destructive/90 transition-colors"
        title="Ver alertas de faltas consecutivas"
      >
        <AlertTriangle className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {alerts.length}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between border border-destructive/30 bg-destructive/10 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" /> Faltas consecutivas
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-destructive/20 rounded">
            <ChevronUp className="h-3.5 w-3.5 text-destructive" />
          </button>
          <button onClick={() => setDismissed(true)} className="p-1 hover:bg-destructive/20 rounded">
            <X className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      </div>
      {alerts.map(a => (
        <div key={a.id} className="flex items-center gap-3 border border-destructive/30 bg-destructive/10 rounded-lg px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{a.name}</span> ultrapassou{' '}
            <span className="font-semibold">{THRESHOLD} faltas consecutivas</span>{' '}
            (atualmente {a.streak} faltas seguidas)
          </p>
        </div>
      ))}
    </div>
  );
}
