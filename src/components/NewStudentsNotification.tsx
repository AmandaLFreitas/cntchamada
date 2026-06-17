import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useNewStudents } from '@/hooks/use-new-students';

export function NewStudentsNotification() {
  const [open, setOpen] = useState(false);
  const { data: newStudents } = useNewStudents();
  const count = newStudents?.length ?? 0;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="relative gap-1.5 h-8 px-2"
        onClick={() => setOpen(true)}
        title="Alunos novos"
      >
        <Sparkles className="h-4 w-4 text-blue-500" />
        <span className="hidden sm:inline text-xs">Alunos Novos</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 sm:static sm:ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-blue-500 text-white">
            {count}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              Alunos Novos ({count})
            </DialogTitle>
          </DialogHeader>
          {count === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum aluno novo no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {newStudents!.map((ns) => (
                <div key={ns.studentCourseId} className="border rounded-lg p-3 bg-card">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">Novo</Badge>
                    <p className="font-semibold">{ns.fullName}</p>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
                    <p><span className="text-foreground/70">Curso:</span> {ns.courseName}</p>
                    <p><span className="text-foreground/70">Unidade:</span> {ns.schoolName}</p>
                    <p>
                      <span className="text-foreground/70">Início:</span> {ns.startDateFormatted || '—'}
                      {ns.isFutureStart && (
                        <span className="ml-2 text-blue-600 font-medium">a iniciar</span>
                      )}
                    </p>
                    <div>
                      <span className="text-foreground/70">Horários:</span>
                      {ns.schedules.length === 0 ? (
                        <span className="ml-1">—</span>
                      ) : (
                        <ul className="ml-4 list-disc">
                          {ns.schedules.map((s, i) => (
                            <li key={i}>{s.day_of_week} {s.start_time}–{s.end_time}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
