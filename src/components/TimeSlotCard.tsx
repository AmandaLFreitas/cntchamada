import { Clock, Users } from 'lucide-react';
import { getMaxStudentsForSchool } from '@/lib/constants';
import { useSchool } from '@/contexts/SchoolContext';

interface TimeSlotCardProps {
  startTime: string;
  endTime: string;
  studentCount: number;
  onClick: () => void;
  dayLabel?: string;
}

export function TimeSlotCard({ startTime, endTime, studentCount, onClick, dayLabel }: TimeSlotCardProps) {
  const { school } = useSchool();
  const max = getMaxStudentsForSchool(school?.slug);
  const available = Math.max(0, max - studentCount);
  const warnThreshold = Math.max(1, max - 5);

  return (
    <button
      onClick={onClick}
      className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer text-left w-full"
    >
      {dayLabel && (
        <div className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">{dayLabel}</div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-foreground">{startTime} - {endTime}</span>
      </div>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
          studentCount >= max
            ? 'bg-destructive/10 text-destructive'
            : studentCount >= warnThreshold
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-primary/10 text-primary'
        }`}>
          {studentCount}/{max} alunos
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {available} {available === 1 ? 'vaga' : 'vagas'}
        </span>
      </div>
    </button>
  );
}
