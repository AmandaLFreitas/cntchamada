import { Clock, Users } from 'lucide-react';
import { MAX_STUDENTS_PER_SLOT } from '@/lib/constants';

interface TimeSlotCardProps {
  startTime: string;
  endTime: string;
  studentCount: number;
  onClick: () => void;
}

export function TimeSlotCard({ startTime, endTime, studentCount, onClick }: TimeSlotCardProps) {
  const available = MAX_STUDENTS_PER_SLOT - studentCount;

  return (
    <button
      onClick={onClick}
      className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer text-left w-full"
    >
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-foreground">{startTime} - {endTime}</span>
      </div>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
          studentCount >= MAX_STUDENTS_PER_SLOT
            ? 'bg-destructive/10 text-destructive'
            : studentCount > 15
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-primary/10 text-primary'
        }`}>
          {studentCount}/{MAX_STUDENTS_PER_SLOT} alunos
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {available} {available === 1 ? 'vaga' : 'vagas'}
        </span>
      </div>
    </button>
  );
}
