import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayTabs } from '@/components/DayTabs';
import { TimeSlotCard } from '@/components/TimeSlotCard';
import { useTimeSlots, useSlotCounts, useSlotStudents, useAttendance, useSaveAttendance } from '@/hooks/use-supabase-data';
import { getTodayDayName, DAYS_OF_WEEK } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, X, Minus, MessageSquare, BookOpen, LifeBuoy, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useSchool } from '@/contexts/SchoolContext';
import { StudentObservationsDialog } from '@/components/StudentObservationsDialog';
import { StudentDetailsDialog } from '@/components/StudentDetailsDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { openWhatsApp } from '@/lib/utils';
import { useFinalizingStudents } from '@/hooks/use-finalizing-students';
import { toast } from 'sonner';
import { fetchStudentIdsWithAnyAttendance } from '@/lib/new-students';




const dayNameFromDate = (date: Date): string => {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const name = days[date.getDay()];
  if (name === 'Domingo' || name === 'Sexta') return 'Segunda';
  return name;
};

function isEnrolledByDate(enrollmentDate: string | null, checkDate: string): boolean {
  if (!enrollmentDate) return true;
  let isoEnrollment = enrollmentDate;
  const parts = enrollmentDate.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    isoEnrollment = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoEnrollment <= checkDate;
}

export default function Attendance() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState(getTodayDayName());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [obsDialogStudentId, setObsDialogStudentId] = useState<string | null>(null);
  const [detailsStudentId, setDetailsStudentId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const { schoolId } = useSchool();

  const isoDate = format(selectedDate, 'yyyy-MM-dd');

  const { data: timeSlots } = useTimeSlots();
  const { data: slotCounts } = useSlotCounts();
  const { data: slotStudents } = useSlotStudents(selectedSlotId);
  const { data: attendance } = useAttendance(isoDate, selectedSlotId);
  const saveAttendance = useSaveAttendance();

  // When searching, find which slots (across ALL days) contain matching students
  const { data: searchSlotIds } = useQuery({
    queryKey: ['attendance_search_all', schoolId, search.trim().toLowerCase()],
    enabled: !!schoolId && search.trim().length >= 2,
    queryFn: async () => {
      const term = `%${search.trim()}%`;
      const { data: matched } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId!)
        .ilike('full_name', term);
      const ids = (matched ?? []).map((r: any) => r.id);
      if (ids.length === 0) return new Set<string>();
      const { data: scheds } = await supabase
        .from('student_schedules')
        .select('time_slot_id')
        .eq('school_id', schoolId!)
        .in('student_id', ids);
      const set = new Set<string>();
      (scheds ?? []).forEach((r: any) => set.add(r.time_slot_id));
      return set;
    },
  });

  const isSearching = search.trim().length >= 2;
  const allDaySlots = timeSlots?.filter(s => s.day_of_week === selectedDay) ?? [];
  const daySlots = isSearching && searchSlotIds
    ? (timeSlots ?? []).filter(s => searchSlotIds.has(s.id))
    : allDaySlots;

  const searchTerm = search.trim().toLowerCase();
  const filteredStudents = (slotStudents ?? []).filter((s: any) => {
    const student = s.students;
    if (!student) return false;
    if (!isEnrolledByDate(student.enrollment_date, isoDate)) return false;
    if (searchTerm.length >= 2 && !(student.full_name || '').toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  // Check which students have any attendance record; any status means the student is not new.
  const studentIdsInSlot = filteredStudents.map((s: any) => s.students?.id).filter(Boolean);
  const { data: existingAttendance } = useQuery({
    queryKey: ['has_any_attendance', studentIdsInSlot, schoolId],
    enabled: studentIdsInSlot.length > 0 && !!schoolId,
    queryFn: async () => {
      return fetchStudentIdsWithAnyAttendance(studentIdsInSlot);
    },
  });

  // Fetch observation counts for students in the slot
  const { data: obsCounts } = useQuery({
    queryKey: ['obs_counts', studentIdsInSlot, schoolId],
    enabled: studentIdsInSlot.length > 0 && !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_observations')
        .select('student_id')
        .eq('school_id', schoolId!)
        .in('student_id', studentIdsInSlot);
      const counts = new Map<string, number>();
      data?.forEach(r => counts.set(r.student_id, (counts.get(r.student_id) || 0) + 1));
      return counts;
    },
  });

  // Finalized students must not be flagged as new either
  const { data: finalizedStudentIds } = useQuery({
    queryKey: ['finalized_student_ids', studentIdsInSlot, schoolId],
    enabled: studentIdsInSlot.length > 0 && !!schoolId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('student_courses')
        .select('student_id')
        .eq('school_id', schoolId!)
        .eq('status', 'finalizado')
        .in('student_id', studentIdsInSlot);
      return new Set<string>((data ?? []).map((r: any) => r.student_id));
    },
  });

  // "Novo" = nenhum registro na tabela attendance e nenhum curso finalizado
  const isNewStudent = (studentId: string): boolean => {
    if (!existingAttendance) return false;
    if (existingAttendance.has(studentId)) return false;
    if (finalizedStudentIds?.has(studentId)) return false;
    return true;
  };

  // Parse a date string (dd/mm/yyyy or yyyy-mm-dd) into ISO yyyy-mm-dd
  const toIso = (v: string | null | undefined): string | null => {
    if (!v) return null;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split('/');
      return `${y}-${m}-${d}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    return null;
  };

  // True when student's course start date is AFTER the selected date (i.e. not yet started)
  const hasNotStarted = (student: any): boolean => {
    const startIso = toIso(student.first_class_date || student.enrollment_date);
    if (!startIso) return false;
    return startIso > isoDate;
  };

  const fmtBR = (iso: string): string => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const getRecord = (studentId: string) => {
    return attendance?.find(a => a.student_id === studentId) as any;
  };
  const getStatus = (studentId: string) => {
    return getRecord(studentId)?.status ?? null;
  };

  const markAttendance = (studentId: string, status: string) => {
    if (!selectedSlotId) return;
    const current = getStatus(studentId);
    // Toggle: clicking same status clears it
    const next = current === status ? '' : status;
    saveAttendance.mutate({ studentId, timeSlotId: selectedSlotId, date: isoDate, status: next });
  };

  const updateJustification = (studentId: string, values: { isJustified: boolean; note: string }) => {
    if (!selectedSlotId) return;
    saveAttendance.mutate({
      studentId,
      timeSlotId: selectedSlotId,
      date: isoDate,
      status: 'absent',
      isJustified: values.isJustified,
      absenceNote: values.note || null,
    });
  };


  const finalizing = useFinalizingStudents();
  const finalizingMap = new Map<string, any>();
  finalizing.forEach(f => finalizingMap.set(f.studentId, f));

  const toggleMaterial = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await (supabase as any).from('students').update({ material_sent: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slot_students'] });
      qc.invalidateQueries({ queryKey: ['students'] });
      toast.success('Apostila atualizada');
    },
  });

  const toggleRescue = useMutation({
    mutationFn: async ({ scId, value }: { scId: string; value: boolean }) => {
      const { error } = await (supabase as any).from('student_courses').update({ rescue_flagged: value }).eq('id', scId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slot_students'] });
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['rescue'] });
      toast.success('Atualizado para Resgate');
    },
  });

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    const dayName = dayNameFromDate(date);
    if (DAYS_OF_WEEK.includes(dayName as any)) {
      setSelectedDay(dayName);
    }
  };

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
    // Find the nearest date matching this day
    const dayIndex = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].indexOf(day);
    if (dayIndex >= 0) {
      const current = new Date(selectedDate);
      const currentDayIndex = current.getDay();
      let diff = dayIndex - currentDayIndex;
      if (diff > 0) diff -= 7; // go to the most recent past occurrence
      if (diff === 0) return; // same day, keep date
      const newDate = new Date(current);
      newDate.setDate(current.getDate() + diff);
      setSelectedDate(newDate);
    }
  };

  const navigateDate = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    handleDateSelect(newDate);
  };

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (!schoolId || !timeSlots) return;
    setExporting(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth(); // 0-11
      const monthNames = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
      const monthLabel = monthNames[month];

      // Day name -> JS day index (0=Sun)
      const dayIndex: Record<string, number> = { 'Domingo':0,'Segunda':1,'Terça':2,'Quarta':3,'Quinta':4,'Sexta':5,'Sábado':6 };

      const datesInMonthForWeekday = (wd: number): Date[] => {
        const out: Date[] = [];
        const d = new Date(year, month, 1);
        while (d.getMonth() === month) {
          if (d.getDay() === wd) out.push(new Date(d));
          d.setDate(d.getDate() + 1);
        }
        return out;
      };

      // Fetch students + courses + schedules for this school
      const { data: scheds, error: e1 } = await (supabase as any)
        .from('student_schedules')
        .select('time_slot_id, student_course_id, students:students(id, full_name, birth_date, enrollment_date, first_class_date, workload, courses:courses(name), custom_course_name)')
        .eq('school_id', schoolId);
      if (e1) throw e1;

      // Weekly hours per student (sum of slot durations across all their schedules)
      const slotById = new Map<string, any>();
      (timeSlots ?? []).forEach(s => slotById.set(s.id, s));
      const slotHours = (id: string): number => {
        const s = slotById.get(id);
        if (!s?.start_time || !s?.end_time) return 1;
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        return Math.max((eh + em/60) - (sh + sm/60), 1);
      };
      const weeklyByStudent = new Map<string, number>();
      (scheds ?? []).forEach((r: any) => {
        const sid = r.students?.id;
        if (!sid) return;
        weeklyByStudent.set(sid, (weeklyByStudent.get(sid) || 0) + slotHours(r.time_slot_id));
      });

      // Attendance for the whole month
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      const isoStart = format(monthStart, 'yyyy-MM-dd');
      const isoEnd = format(monthEnd, 'yyyy-MM-dd');
      const { data: attRows, error: e2 } = await supabase
        .from('attendance')
        .select('student_id, time_slot_id, date, status')
        .eq('school_id', schoolId)
        .gte('date', isoStart)
        .lte('date', isoEnd);
      if (e2) throw e2;
      const attMap = new Map<string, string>();
      (attRows ?? []).forEach((a: any) => attMap.set(`${a.student_id}|${a.time_slot_id}|${a.date}`, a.status));

      const statusMark = (s?: string) => s === 'present' ? '✔' : s === 'absent' ? '✗' : s === 'neutral' ? '/' : '';

      const fmtDM = (v?: string | null): string => {
        if (!v) return '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const [d,m] = v.split('/'); return `${parseInt(d,10)}/${parseInt(m,10)}`; }
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) { const [y,m,d] = v.slice(0,10).split('-'); return `${parseInt(d,10)}/${parseInt(m,10)}`; }
        return v;
      };
      const parseAny = (v?: string | null): Date | null => {
        if (!v) return null;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const [d,m,y] = v.split('/').map(Number); return new Date(y, m-1, d); }
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) { const [y,m,d] = v.slice(0,10).split('-').map(Number); return new Date(y, m-1, d); }
        return null;
      };
      const predictedEnd = (st: any): string => {
        const start = parseAny(st.first_class_date || st.enrollment_date);
        const wh = weeklyByStudent.get(st.id) || 0;
        const workload = st.workload || 48;
        if (!start || wh <= 0) return '';
        const weeks = Math.ceil(workload / wh);
        const end = new Date(start); end.setDate(end.getDate() + weeks * 7);
        return `${end.getDate()}/${end.getMonth() + 1}`;
      };

      // Styling helpers
      const border = { style: 'thin', color: { rgb: '000000' } } as const;
      const allBorders = { top: border, bottom: border, left: border, right: border };
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { patternType: 'solid', fgColor: { rgb: '4A5568' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: allBorders,
      };
      const colHeaderStyle = {
        font: { bold: true, sz: 10 },
        fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: allBorders,
      };
      const cellStyle = {
        font: { sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: allBorders,
      };
      const nameStyle = { ...cellStyle, alignment: { horizontal: 'left', vertical: 'center' } };
      const idxStyle = { ...cellStyle, fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } }, font: { bold: true, sz: 10 } };
      const highlightRowStyle = { ...cellStyle, fill: { patternType: 'solid', fgColor: { rgb: 'D1D5DB' } } };
      const highlightIdxStyle = { ...idxStyle, fill: { patternType: 'solid', fgColor: { rgb: '9CA3AF' } } };

      // Build a single block at given top-left, returns rows used. Writes into ws (object).
      type Cell = { v: any; s?: any };
      const writeBlock = (
        cells: Record<string, Cell>,
        merges: { s: { r: number; c: number }; e: { r: number; c: number } }[],
        rowTop: number,
        colLeft: number,
        dayName: string,
        slot: any,
        dates: Date[],
      ) => {
        const ROWS = 20;
        const FIXED_COLS = ['', 'ALUNO', 'NASC', 'CURSO']; // indices 0..3 (col 0 = #)
        const totalCols = 4 + dates.length + 2; // # ALUNO NASC CURSO [dates] INICIO FIM
        const lastCol = colLeft + totalCols - 1;

        // Row 0: title spanning all cols
        const titleAddr = XLSX.utils.encode_cell({ r: rowTop, c: colLeft });
        cells[titleAddr] = { v: `${dayName.toUpperCase()} (${slot.start_time} AS ${slot.end_time})`, s: headerStyle };
        merges.push({ s: { r: rowTop, c: colLeft }, e: { r: rowTop, c: lastCol } });
        // fill merged cells with empty styled placeholders so borders render
        for (let c = colLeft + 1; c <= lastCol; c++) {
          cells[XLSX.utils.encode_cell({ r: rowTop, c })] = { v: '', s: headerStyle };
        }

        // Row 1: column headers (with MARÇO merged + INICIO/FIM merged across 2 rows)
        const hdrRow = rowTop + 1;
        const subRow = rowTop + 2;
        // # — merged across hdr+sub
        cells[XLSX.utils.encode_cell({ r: hdrRow, c: colLeft })] = { v: '', s: colHeaderStyle };
        cells[XLSX.utils.encode_cell({ r: subRow, c: colLeft })] = { v: '', s: colHeaderStyle };
        merges.push({ s: { r: hdrRow, c: colLeft }, e: { r: subRow, c: colLeft } });
        // ALUNO, NASC, CURSO — merged across hdr+sub
        FIXED_COLS.slice(1).forEach((label, i) => {
          const c = colLeft + 1 + i;
          cells[XLSX.utils.encode_cell({ r: hdrRow, c })] = { v: label, s: colHeaderStyle };
          cells[XLSX.utils.encode_cell({ r: subRow, c })] = { v: '', s: colHeaderStyle };
          merges.push({ s: { r: hdrRow, c }, e: { r: subRow, c } });
        });
        // MARÇO header merged across date cols
        const monthColStart = colLeft + 4;
        const monthColEnd = monthColStart + dates.length - 1;
        cells[XLSX.utils.encode_cell({ r: hdrRow, c: monthColStart })] = { v: monthLabel, s: colHeaderStyle };
        for (let c = monthColStart + 1; c <= monthColEnd; c++) {
          cells[XLSX.utils.encode_cell({ r: hdrRow, c })] = { v: '', s: colHeaderStyle };
        }
        merges.push({ s: { r: hdrRow, c: monthColStart }, e: { r: hdrRow, c: monthColEnd } });
        // sub row: date numbers
        dates.forEach((d, i) => {
          cells[XLSX.utils.encode_cell({ r: subRow, c: monthColStart + i })] = { v: d.getDate(), s: colHeaderStyle };
        });
        // INICIO, FIM merged hdr+sub
        const inicioCol = monthColEnd + 1;
        const fimCol = inicioCol + 1;
        cells[XLSX.utils.encode_cell({ r: hdrRow, c: inicioCol })] = { v: 'INICIO', s: colHeaderStyle };
        cells[XLSX.utils.encode_cell({ r: subRow, c: inicioCol })] = { v: '', s: colHeaderStyle };
        merges.push({ s: { r: hdrRow, c: inicioCol }, e: { r: subRow, c: inicioCol } });
        cells[XLSX.utils.encode_cell({ r: hdrRow, c: fimCol })] = { v: 'FIM', s: colHeaderStyle };
        cells[XLSX.utils.encode_cell({ r: subRow, c: fimCol })] = { v: '', s: colHeaderStyle };
        merges.push({ s: { r: hdrRow, c: fimCol }, e: { r: subRow, c: fimCol } });

        // Enrolled students in this slot for this day
        const enrolled = (scheds ?? [])
          .filter((r: any) => r.time_slot_id === slot.id && r.students)
          .map((r: any) => r.students)
          // dedupe by id
          .filter((st: any, i: number, arr: any[]) => arr.findIndex(x => x.id === st.id) === i)
          .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR'));

        for (let i = 0; i < ROWS; i++) {
          const r = subRow + 1 + i;
          const isHighlight = i === 8; // row 9 (1-based) inside the 18-row block
          const rowStyle = isHighlight ? highlightRowStyle : cellStyle;
          const rowIdxStyle = isHighlight ? highlightIdxStyle : idxStyle;
          const rowNameStyle = isHighlight
            ? { ...nameStyle, fill: highlightRowStyle.fill }
            : nameStyle;
          const st = enrolled[i];
          // # column
          cells[XLSX.utils.encode_cell({ r, c: colLeft })] = { v: i + 1, s: rowIdxStyle };
          // ALUNO
          cells[XLSX.utils.encode_cell({ r, c: colLeft + 1 })] = { v: st ? (st.full_name || '').toUpperCase() : '', s: rowNameStyle };
          // NASC
          cells[XLSX.utils.encode_cell({ r, c: colLeft + 2 })] = { v: st ? fmtDM(st.birth_date) : '', s: rowStyle };
          // CURSO
          const courseName = st ? (st.courses?.name || st.custom_course_name || '') : '';
          cells[XLSX.utils.encode_cell({ r, c: colLeft + 3 })] = { v: courseName, s: rowStyle };
          // Dates
          dates.forEach((d, di) => {
            const iso = format(d, 'yyyy-MM-dd');
            const mark = st ? statusMark(attMap.get(`${st.id}|${slot.id}|${iso}`)) : '';
            cells[XLSX.utils.encode_cell({ r, c: monthColStart + di })] = { v: mark, s: rowStyle };
          });
          // INICIO
          cells[XLSX.utils.encode_cell({ r, c: inicioCol })] = { v: st ? fmtDM(st.first_class_date || st.enrollment_date) : '', s: rowStyle };
          // FIM
          cells[XLSX.utils.encode_cell({ r, c: fimCol })] = { v: st ? predictedEnd(st) : '', s: rowStyle };
        }

        return { rowsUsed: 3 + ROWS, totalCols };
      };

      const buildSheet = (days: string[]) => {
        const cells: Record<string, any> = {};
        const merges: any[] = [];
        // Unique slot key (start-end) appearing on any of the days, sorted by start
        const keySet = new Map<string, { start: string; end: string }>();
        (timeSlots ?? []).forEach(s => {
          if (days.includes(s.day_of_week)) {
            const k = `${s.start_time}-${s.end_time}`;
            if (!keySet.has(k)) keySet.set(k, { start: s.start_time, end: s.end_time });
          }
        });
        const sortedKeys = Array.from(keySet.entries()).sort((a, b) => a[1].start.localeCompare(b[1].start));

        let cursorRow = 0;
        const blockGap = 2;
        const colGap = 1;
        let maxCol = 0;
        let firstBlockCols = 0;

        for (const [, sk] of sortedKeys) {
          // Find slot per day with this start/end
          const slotsForKey = days.map(d => (timeSlots ?? []).find(s => s.day_of_week === d && s.start_time === sk.start && s.end_time === sk.end));
          let colCursor = 0;
          let usedRows = 0;
          for (let di = 0; di < days.length; di++) {
            const day = days[di];
            const slot = slotsForKey[di];
            if (!slot) {
              // still advance col cursor using approximate width based on day's date count
              const dates = datesInMonthForWeekday(dayIndex[day]);
              colCursor += (4 + dates.length + 2) + colGap;
              continue;
            }
            const dates = datesInMonthForWeekday(dayIndex[day]);
            const { rowsUsed, totalCols } = writeBlock(cells, merges, cursorRow, colCursor, day, slot, dates);
            usedRows = Math.max(usedRows, rowsUsed);
            if (di === 0) firstBlockCols = totalCols;
            colCursor += totalCols + colGap;
            maxCol = Math.max(maxCol, colCursor - colGap - 1);
          }
          cursorRow += usedRows + blockGap;
        }

        // Build worksheet
        const ws: any = {};
        Object.entries(cells).forEach(([addr, cell]) => { ws[addr] = cell; });
        const range = { s: { r: 0, c: 0 }, e: { r: Math.max(cursorRow, 1), c: Math.max(maxCol, 1) } };
        ws['!ref'] = XLSX.utils.encode_range(range);
        ws['!merges'] = merges;
        // Column widths: # narrow, ALUNO wide, NASC narrow, CURSO medium, dates narrow, INICIO/FIM small
        const cols: any[] = [];
        for (let c = 0; c <= maxCol; c++) cols.push({ wch: 6 });
        // Set known widths for first block
        if (firstBlockCols > 0) {
          const widths = [4, 22, 7, 12];
          for (let i = 0; i < widths.length && i <= maxCol; i++) cols[i] = { wch: widths[i] };
          // INICIO/FIM at end
          cols[firstBlockCols - 2] = { wch: 7 };
          cols[firstBlockCols - 1] = { wch: 7 };
          // gap column
          if (firstBlockCols < cols.length) cols[firstBlockCols] = { wch: 2 };
          // right block mirroring
          const rOff = firstBlockCols + 1;
          for (let i = 0; i < widths.length && rOff + i <= maxCol; i++) cols[rOff + i] = { wch: widths[i] };
          if (rOff + firstBlockCols - 2 <= maxCol) cols[rOff + firstBlockCols - 2] = { wch: 7 };
          if (rOff + firstBlockCols - 1 <= maxCol) cols[rOff + firstBlockCols - 1] = { wch: 7 };
        }
        ws['!cols'] = cols;
        return ws;
      };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, buildSheet(['Segunda', 'Quarta']), 'SEG-QUA');
      XLSX.utils.book_append_sheet(wb, buildSheet(['Terça', 'Quinta']), 'TER-QUI');
      XLSX.utils.book_append_sheet(wb, buildSheet(['Sábado']), 'SÁBADO');

      const fname = `chamada_${monthLabel.toLowerCase()}_${year}.xlsx`;
      XLSX.writeFile(wb, fname);
      toast.success('Planilha gerada!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao exportar Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">Chamada</h1>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting} className="gap-2">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">{exporting ? 'Gerando...' : 'Exportar Excel'}</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[180px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DayTabs value={selectedDay} onChange={handleDayChange} />

      <div className="relative my-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mt-4">
        {daySlots.map(slot => (
          <TimeSlotCard key={slot.id} startTime={slot.start_time} endTime={slot.end_time} studentCount={slotCounts?.[slot.id] ?? 0} onClick={() => setSelectedSlotId(slot.id)} dayLabel={isSearching ? slot.day_of_week : undefined} />
        ))}
      </div>

      <Dialog open={!!selectedSlotId} onOpenChange={() => setSelectedSlotId(null)}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Chamada - {format(selectedDate, "dd/MM/yyyy")} ({selectedDay})</DialogTitle>
          </DialogHeader>
          {filteredStudents.length > 0 ? (
            <div className="space-y-2">
              {filteredStudents.map((s: any) => {
                const student = s.students;
                if (!student) return null;
                const status = getStatus(student.id);
                const record = getRecord(student.id);
                const absenceJustified = !!record?.is_justified;
                const absenceNote: string = record?.absence_note ?? '';

                const courseName = student.courses?.name || student.custom_course_name || 'N/A';
                const materialSent = !!student.material_sent;
                const fin = finalizingMap.get(student.id);
                const isFinalizing = !!fin;
                const isRescued = !!s.rescue_flagged;
                return (
                  <div key={s.id} className="border rounded-lg p-3 bg-card space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (student.photo_url) setLightboxSrc(student.photo_url); else setDetailsStudentId(student.id); }}
                          className="shrink-0"
                          title={student.photo_url ? 'Ver foto' : 'Sem foto'}
                        >
                          <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                            {student.photo_url && <AvatarImage src={student.photo_url} alt={student.full_name || 'Aluno'} />}
                            <AvatarFallback className="text-xs">
                              {(student.full_name || '?').split(' ').filter(Boolean).slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailsStudentId(student.id)}
                          className="min-w-0 flex-1 text-left"
                          title="Ver dados do aluno"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate text-sm sm:text-base hover:underline flex items-center gap-1.5">
                              <span className="truncate">{student.full_name || 'Sem nome'}</span>
                              {(obsCounts?.get(student.id) ?? 0) > 0 && (
                                <span className="shrink-0 h-2 w-2 rounded-full bg-destructive" title="Possui observações" />
                              )}
                            </span>
                            {isNewStudent(student.id) && (
                              <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">Novo</Badge>
                            )}
                            {isFinalizing && (
                              <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0">Finalizando</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{courseName}</p>
                        </button>
                      </div>
                      <div className="flex gap-1.5 ml-auto sm:ml-2 flex-wrap justify-end">
                        <Button size="icon" variant="ghost" className="h-8 w-8 relative"
                          onClick={() => setObsDialogStudentId(student.id)}
                          title="Observação">
                          <MessageSquare className="h-4 w-4" />
                          {(obsCounts?.get(student.id) ?? 0) > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-card" />
                          )}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9"
                          onClick={() => toggleMaterial.mutate({ id: student.id, value: !materialSent })}
                          title={materialSent ? 'Apostila enviada (clique para desmarcar)' : 'Apostila NÃO enviada (clique para marcar)'}>
                          <BookOpen className={cn('h-5 w-5', materialSent ? 'text-blue-600' : 'text-destructive')} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => toggleRescue.mutate({ scId: s.student_course_id, value: !isRescued })}
                          title={isRescued ? 'Remover do Resgate' : 'Enviar para Resgate'}>
                          <LifeBuoy className={cn('h-4 w-4', isRescued ? 'text-orange-600 fill-orange-100' : 'text-muted-foreground')} />
                        </Button>
                        {hasNotStarted(student) ? (
                          <span className="text-xs text-blue-600 font-medium self-center px-2 py-1 rounded bg-blue-50 border border-blue-200">
                            Aluno iniciará em {fmtBR(toIso(student.first_class_date || student.enrollment_date)!)}
                          </span>
                        ) : (
                          <>
                            <Button size="icon" variant={status === 'present' ? 'default' : 'outline'}
                              className={status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                              onClick={() => markAttendance(student.id, 'present')} title="Presença (clique novamente para desmarcar)">
                              <Check className={cn('h-4 w-4', status !== 'present' && 'text-green-600')} />
                            </Button>
                            <Button size="icon" variant={status === 'absent' ? 'default' : 'outline'}
                              className={status === 'absent' ? 'bg-destructive hover:bg-destructive/90' : ''}
                              onClick={() => markAttendance(student.id, 'absent')} title="Falta (clique novamente para desmarcar)">
                              <X className={cn('h-4 w-4', status !== 'absent' && 'text-destructive')} />
                            </Button>
                            {status === 'absent' && (
                              <AbsenceJustificationPopover
                                isJustified={absenceJustified}
                                note={absenceNote}
                                onSave={(v) => updateJustification(student.id, v)}
                              />
                            )}

                            <Button size="icon" variant={status === 'neutral' ? 'default' : 'outline'}
                              className={status === 'neutral' ? 'bg-muted-foreground hover:bg-muted-foreground/90 text-white' : ''}
                              onClick={() => markAttendance(student.id, 'neutral')} title="Neutro (feriado/sem aula)">
                              <Minus className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Nenhum aluno neste horário.</p>
          )}
        </DialogContent>
      </Dialog>

      <StudentObservationsDialog
        open={!!obsDialogStudentId}
        onOpenChange={(open) => { if (!open) setObsDialogStudentId(null); }}
        studentId={obsDialogStudentId}
        studentName={filteredStudents.find((s: any) => s.students?.id === obsDialogStudentId)?.students?.full_name || 'Aluno'}
      />
      <StudentDetailsDialog
        open={!!detailsStudentId}
        onOpenChange={(open) => { if (!open) setDetailsStudentId(null); }}
        studentId={detailsStudentId}
      />
      <PhotoLightbox
        open={!!lightboxSrc}
        onOpenChange={(open) => { if (!open) setLightboxSrc(null); }}
        src={lightboxSrc || ''}
      />
    </div>
  );
}
