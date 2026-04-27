import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useFinalizingStudents } from '@/hooks/use-finalizing-students';
import { AlertTriangle } from 'lucide-react';

export default function Finalizing() {
  const finalizing = useFinalizingStudents();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-bold text-foreground">Alunos Finalizando o Curso</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Lista automática de alunos com 80% ou mais de progresso no curso atual.
      </p>

      {finalizing.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          Nenhum aluno está próximo de finalizar o curso no momento.
        </p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead className="hidden md:table-cell">Data Início</TableHead>
                <TableHead className="hidden md:table-cell">Previsão Término</TableHead>
                <TableHead className="text-center">Aulas Restantes</TableHead>
                <TableHead className="min-w-[160px]">Conclusão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalizing.map(f => (
                <TableRow key={f.studentCourseId}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell>{f.course}</TableCell>
                  <TableCell className="hidden md:table-cell">{f.startDate || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell">{f.expectedEndDate || '—'}</TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-yellow-600">
                      {f.lessonsRemaining}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({f.hoursRemaining}h)
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={f.pct} className="h-2 flex-1" />
                      <span className="text-xs font-medium w-10 text-right">{f.pct}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
