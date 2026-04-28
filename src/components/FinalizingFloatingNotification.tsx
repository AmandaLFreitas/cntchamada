import { AlertTriangle, X, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinalizingStudents } from '@/hooks/use-finalizing-students';

const firstName = (full: string) => (full || '').trim().split(/\s+/)[0] || full;

export function FinalizingFloatingNotification() {
  const navigate = useNavigate();
  const finalizing = useFinalizingStudents();
  const [minimized, setMinimized] = useState(true);

  if (!finalizing.length) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-36 z-50 bg-yellow-500 text-white rounded-full p-3 shadow-lg hover:bg-yellow-600 transition-colors"
        title="Alunos finalizando o curso"
      >
        <AlertTriangle className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {finalizing.length}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-36 z-50 w-72 bg-card border shadow-xl rounded-lg overflow-hidden">
      <div className="bg-yellow-500 text-white px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => navigate('/finalizando')}
          className="flex items-center gap-2 text-sm font-medium hover:underline"
        >
          <AlertTriangle className="h-4 w-4" /> Finalizando curso
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-yellow-600 rounded">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-yellow-600 rounded" title="Fechar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3 text-sm max-h-56 overflow-auto space-y-1.5">
        {finalizing.map(f => (
          <div key={f.studentCourseId} className="flex items-center justify-between gap-2 border-b last:border-b-0 pb-1.5 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{firstName(f.name)}</p>
              <p className="text-xs text-muted-foreground truncate">{f.course}</p>
            </div>
            <span className="text-xs font-semibold text-yellow-700 whitespace-nowrap">
              {f.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
