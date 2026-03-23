import { useRef, useState } from 'react';
import { useStudents } from '@/hooks/use-supabase-data';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileText, Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export function AttendanceReport() {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [manualName, setManualName] = useState('');
  const [showReport, setShowReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: students } = useStudents();

  const selectedStudent = students?.find((s: any) => s.id === selectedStudentId);

  const displayName = manualName || selectedStudent?.full_name || 'Sem nome';

  // Get course name from student_courses
  const activeCourse = selectedStudent?.student_courses?.find((sc: any) => sc.is_active);
  const courseName = selectedStudent
    ? (activeCourse?.courses?.name || activeCourse?.custom_course_name || 'N/A')
    : '';

  const handleGenerate = () => {
    if (!selectedStudentId && !manualName) return;
    setShowReport(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`declaracao-matricula-${displayName}.pdf`);
  };

  const today = new Date();
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const formattedDate = `Toledo, ${String(today.getDate()).padStart(2, '0')} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;

  const courseDisplay = courseName
    ? `CURSO DE ${courseName.toUpperCase()}`
    : '[CURSO]';

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Declaração de Matrícula</h2>

      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="w-full sm:w-72">
          <Label>Selecionar Aluno</Label>
          <Select value={selectedStudentId} onValueChange={(v) => { setSelectedStudentId(v); setManualName(''); }}>
            <SelectTrigger><SelectValue placeholder="Escolha um aluno" /></SelectTrigger>
            <SelectContent>
              {students?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.full_name || 'Sem nome'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-72">
          <Label>Ou digitar nome manualmente</Label>
          <Input placeholder="Nome do aluno" value={manualName} onChange={e => setManualName(e.target.value)} />
        </div>
        <Button onClick={handleGenerate} disabled={!selectedStudentId && !manualName}>
          <FileText className="h-4 w-4 mr-1" /> Gerar Declaração
        </Button>
      </div>

      {showReport && (
        <div className="space-y-4">
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-1" /> Baixar PDF
            </Button>
          </div>

          <div
            ref={reportRef}
            data-report-print
            className="bg-white text-black p-10 border rounded-lg max-w-2xl mx-auto print:border-none print:shadow-none print:max-w-none"
            style={{ fontFamily: 'serif' }}
          >
            <div className="text-center mb-2">
              <p className="text-base font-bold">CNT INFORMÁTICA – TOLEDO</p>
              <p className="text-xs text-gray-600">Rua Almirante Barroso, 2018 – Centro / CEP: 85900-020</p>
              <p className="text-xs text-gray-600">Contato: (45) 99848-4920</p>
              <p className="text-xs text-gray-600">www.cntinformatica.com.br</p>
            </div>

            <h2 className="text-center text-lg font-bold uppercase mt-10 mb-10">
              Declaração de Matrícula
            </h2>

            <p className="mb-6 text-sm">À quem possa interessar,</p>

            <p className="text-sm leading-relaxed text-justify mb-10">
              Declaramos para os devidos fins que o aluno <strong>{displayName.toUpperCase()}</strong>,
              está devidamente matriculado(a) e frequentando o {courseDisplay}.
            </p>

            <p className="text-sm text-right mb-16">{formattedDate}</p>

            <div className="mt-20 text-center">
              <div className="border-t border-black w-64 mx-auto pt-2">
                <p className="text-sm font-medium">Elisangela Neri Rigo</p>
                <p className="text-xs text-gray-600">Coordenação/Direção</p>
              </div>
              <p className="text-xs text-gray-500 mt-6">CNPJ: 32.373.460/0001-51</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
