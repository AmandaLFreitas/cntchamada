import { useMemo, useState } from 'react';
import { useFinalizingStudents } from '@/hooks/use-finalizing-students';
import { AlertTriangle, X, ChevronUp } from 'lucide-react';

export function CourseCompletionAlert() {
  const [dismissed, setDismissed] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const finalizing = useFinalizingStudents();
  const alerts = finalizing.map(row => ({ name: row.name, course: row.course, pct: row.pct, diasRestantes: row.daysRemaining }));

  if (alerts.length === 0 || dismissed) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-20 z-50 bg-yellow-500 text-white rounded-full p-3 shadow-lg hover:bg-yellow-600 transition-colors"
        title="Ver alertas de conclusão"
      >
        <AlertTriangle className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {alerts.length}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-yellow-700">
          <AlertTriangle className="h-4 w-4" /> Alunos finalizando curso
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-yellow-500/20 rounded">
            <ChevronUp className="h-3.5 w-3.5 text-yellow-700" />
          </button>
          <button onClick={() => setDismissed(true)} className="p-1 hover:bg-yellow-500/20 rounded">
            <X className="h-3.5 w-3.5 text-yellow-700" />
          </button>
        </div>
      </div>
      {alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-3 border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{a.name}</span> está finalizando o curso de{' '}
            <span className="font-semibold">{a.course}</span> ({a.pct}% concluído — faltam {a.diasRestantes} {a.diasRestantes === 1 ? 'dia' : 'dias'})
          </p>
        </div>
      ))}
    </div>
  );
}
