import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFinalizingStudents } from '@/hooks/use-finalizing-students';

export function FinalizingNotification() {
  const navigate = useNavigate();
  const finalizing = useFinalizingStudents();
  const count = finalizing.length;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate('/finalizando')}
      title={count > 0 ? `${count} aluno(s) finalizando o curso` : 'Alunos finalizando'}
      className="relative"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-yellow-500 text-white text-[10px] font-semibold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
          {count}
        </span>
      )}
    </Button>
  );
}
