import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { formatPhoneMask, openWhatsApp } from '@/lib/utils';
import { Phone, MessageCircle } from 'lucide-react';
import { formatBR } from '@/hooks/use-new-students';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  desistiu: 'Desistiu',
};

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartão',
  boleto: 'Boleto',
  transferencia: 'Transferência',
};

function calcAge(birth?: string | null): number | null {
  if (!birth) return null;
  const m = birth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) || birth.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  let d: Date;
  if (birth.includes('/')) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  else d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const mo = now.getMonth() - d.getMonth();
  if (mo < 0 || (mo === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function StudentDetailsDialog({ open, onOpenChange, studentId }: Props) {
  const { schoolId } = useSchool();
  const { role } = useAuth();
  const isRestricted = role === 'restricted';
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['student_details', studentId, schoolId],
    enabled: open && !!studentId && !!schoolId,
    queryFn: async () => {
      const { data: student } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId!)
        .maybeSingle();
      const { data: scs } = await (supabase as any)
        .from('student_courses')
        .select('*, courses(name)')
        .eq('school_id', schoolId!)
        .eq('student_id', studentId!);
      const scIds = (scs ?? []).map((sc: any) => sc.id);
      let schedulesByScId: Record<string, any[]> = {};
      if (scIds.length > 0) {
        const { data: scheds } = await supabase
          .from('student_schedules')
          .select('student_course_id, time_slots(day_of_week, start_time, end_time)')
          .in('student_course_id', scIds);
        (scheds ?? []).forEach((row: any) => {
          const k = row.student_course_id;
          if (!schedulesByScId[k]) schedulesByScId[k] = [];
          if (row.time_slots) schedulesByScId[k].push(row.time_slots);
        });
      }
      const { data: observations } = await supabase
        .from('student_observations')
        .select('id, observation, created_at')
        .eq('school_id', schoolId!)
        .eq('student_id', studentId!)
        .order('created_at', { ascending: false });
      return { student, courses: scs ?? [], schedulesByScId, observations: observations ?? [] };
    },
  });

  const student: any = data?.student;
  const age = calcAge(student?.birth_date);
  const isMinor = age !== null && age < 18;
  const address = [student?.street, student?.house_number].filter(Boolean).join(', ');

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <p><span className="text-muted-foreground">{label}:</span> {value ?? '—'}</p>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{student?.full_name || 'Aluno'}</DialogTitle>
        </DialogHeader>
        {!student ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => student.photo_url && setLightboxOpen(true)} title={student.photo_url ? 'Ampliar foto' : 'Sem foto'}>
                <Avatar className="h-16 w-16">
                  {student.photo_url && <AvatarImage src={student.photo_url} alt={student.full_name || 'Aluno'} />}
                  <AvatarFallback>
                    {(student.full_name || '?').split(' ').filter(Boolean).slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="min-w-0">
                <p className="font-semibold truncate">{student.full_name || 'Aluno'}</p>
                {age !== null && <p className="text-muted-foreground text-xs">{age} anos</p>}
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-1">
              <p className="font-semibold mb-1">Dados pessoais</p>
              <Row label="Nome completo" value={student.full_name} />
              <Row label="Data de nascimento" value={formatBR(student.birth_date) || student.birth_date || '—'} />
              {!isRestricted && <Row label="CPF" value={student.cpf} />}
              {!isRestricted && <Row label="Endereço" value={address || '—'} />}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Telefone:</span>
                <span>{formatPhoneMask(student.phone) || '—'}</span>
                {student.phone && (
                  <>
                    <a href={`tel:${student.phone.replace(/\D/g, '')}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Phone className="h-3 w-3" /> Ligar
                    </a>
                    <button type="button" onClick={() => openWhatsApp(student.phone)} className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline">
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </button>
                  </>
                )}
              </div>
              {isMinor && (
                <>
                  <Row label="Responsável" value={student.guardian_name} />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground">Telefone do responsável:</span>
                    <span>{formatPhoneMask(student.guardian_phone) || '—'}</span>
                    {student.guardian_phone && (
                      <button type="button" onClick={() => openWhatsApp(student.guardian_phone)} className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline">
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </button>
                    )}
                  </div>
                </>
              )}
              {!isRestricted && <Row label="Data de matrícula" value={formatBR(student.enrollment_date) || student.enrollment_date || '—'} />}
              {!isRestricted && <Row label="Forma de pagamento" value={PAYMENT_LABELS[student.payment_method] || student.payment_method || '—'} />}
              <Row label="Material enviado" value={student.material_sent ? 'Sim' : 'Não'} />
              <Row label="Situação" value={student.is_active ? 'Ativo' : 'Inativo'} />
            </div>

            {(data?.courses ?? []).length === 0 && (
              <p className="text-muted-foreground">Sem cursos cadastrados.</p>
            )}
            {(data?.courses ?? []).map((sc: any) => {
              const scheds = data?.schedulesByScId[sc.id] ?? [];
              return (
                <div key={sc.id} className="border rounded-lg p-3 space-y-1">
                  <p className="font-semibold">{sc.courses?.name || sc.custom_course_name || 'Sem curso'}</p>
                  <Row label="Início" value={formatBR(sc.first_class_date || sc.enrollment_date) || '—'} />
                  <Row label="Carga horária" value={`${sc.workload}h`} />
                  <Row label="Status" value={STATUS_LABELS[sc.status] || sc.status} />
                  <div>
                    <span className="text-muted-foreground">Horários:</span>
                    {scheds.length === 0 ? (
                      <span className="ml-1">—</span>
                    ) : (
                      <ul className="ml-4 list-disc">
                        {scheds.map((t: any, i: number) => (
                          <li key={i}>{t.day_of_week} {t.start_time}–{t.end_time}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="border rounded-lg p-3 space-y-1">
              <p className="font-semibold">Observações</p>
              {(data?.observations ?? []).length === 0 ? (
                <p className="text-muted-foreground">Nenhuma observação registrada.</p>
              ) : (
                <div className="space-y-2">
                  {(data?.observations ?? []).map((obs: any) => (
                    <p key={obs.id} className="whitespace-pre-wrap">{obs.observation}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
      <PhotoLightbox open={lightboxOpen} onOpenChange={setLightboxOpen} src={student?.photo_url || ''} alt={student?.full_name || 'Aluno'} />
    </Dialog>
  );
}
