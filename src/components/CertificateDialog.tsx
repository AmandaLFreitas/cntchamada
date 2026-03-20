import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCertificateTemplate, type CertificateData } from '@/lib/certificate-templates';
import { Printer, Download, Eye, Pencil } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CertificateData;
}

export function CertificateDialog({ open, onOpenChange, data }: Props) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [text, setText] = useState('');
  const [studentName, setStudentName] = useState(data.studentName);
  const [courseName, setCourseName] = useState(data.courseName);
  const [workload, setWorkload] = useState(data.workload);
  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setStudentName(data.studentName);
      setCourseName(data.courseName);
      setWorkload(data.workload);
      setText(getCertificateTemplate(data));
      setMode('edit');
    }
  }, [open, data]);

  const handlePrint = () => {
    const content = certRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Certificado</title><style>
      @page { size: landscape; margin: 0; }
      body { margin: 0; font-family: 'Georgia', serif; }
      .cert { width: 297mm; height: 210mm; box-sizing: border-box; padding: 24mm; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 8px double #1a365d; position: relative; }
      .cert::before { content: ''; position: absolute; inset: 8px; border: 2px solid #c6a14a; pointer-events: none; }
      h1 { font-size: 32pt; color: #1a365d; margin: 0 0 4mm; letter-spacing: 2px; }
      h2 { font-size: 14pt; color: #4a5568; font-weight: normal; margin: 0 0 12mm; }
      .body-text { font-size: 13pt; line-height: 1.8; text-align: center; max-width: 220mm; white-space: pre-wrap; color: #2d3748; }
      .footer { margin-top: 20mm; display: flex; gap: 60mm; }
      .sig { text-align: center; width: 70mm; }
      .sig-line { border-top: 1px solid #2d3748; margin-bottom: 2mm; }
      .sig-label { font-size: 10pt; color: #4a5568; }
    </style></head><body>`);
    w.document.write(content.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  const handleDownload = async () => {
    const el = certRef.current;
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
    pdf.save(`certificado-${studentName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Certificado — {studentName}</DialogTitle>
        </DialogHeader>

        {mode === 'edit' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome do Aluno</Label>
                <Input value={studentName} onChange={e => setStudentName(e.target.value)} />
              </div>
              <div>
                <Label>Curso</Label>
                <Input value={courseName} onChange={e => setCourseName(e.target.value)} />
              </div>
              <div>
                <Label>Carga Horária (horas)</Label>
                <Input type="number" value={workload} onChange={e => setWorkload(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <Label>Texto do Certificado</Label>
              <Textarea value={text} onChange={e => setText(e.target.value)} rows={8} />
            </div>
            <Button onClick={() => setMode('preview')} className="gap-2">
              <Eye className="h-4 w-4" /> Visualizar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              ref={certRef}
              style={{
                width: '297mm',
                height: '210mm',
                padding: '24mm',
                border: '8px double #1a365d',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Georgia', serif",
                background: '#fff',
                boxSizing: 'border-box',
                transform: 'scale(0.35)',
                transformOrigin: 'top left',
              }}
            >
              <div style={{ position: 'absolute', inset: '8px', border: '2px solid #c6a14a', pointerEvents: 'none' }} />
              <h1 style={{ fontSize: '32pt', color: '#1a365d', margin: '0 0 4mm', letterSpacing: '2px' }}>CERTIFICADO</h1>
              <h2 style={{ fontSize: '14pt', color: '#4a5568', fontWeight: 'normal', margin: '0 0 12mm' }}>CNT Informática</h2>
              <div style={{ fontSize: '13pt', lineHeight: 1.8, textAlign: 'center', maxWidth: '220mm', whiteSpace: 'pre-wrap', color: '#2d3748' }}>
                {text}
              </div>
              <div style={{ marginTop: '20mm', display: 'flex', gap: '60mm' }}>
                <div style={{ textAlign: 'center', width: '70mm' }}>
                  <div style={{ borderTop: '1px solid #2d3748', marginBottom: '2mm' }} />
                  <div style={{ fontSize: '10pt', color: '#4a5568' }}>Diretor(a)</div>
                </div>
                <div style={{ textAlign: 'center', width: '70mm' }}>
                  <div style={{ borderTop: '1px solid #2d3748', marginBottom: '2mm' }} />
                  <div style={{ fontSize: '10pt', color: '#4a5568' }}>Instrutor(a)</div>
                </div>
              </div>
            </div>
            <div style={{ height: `calc(210mm * 0.35)` }} />

            <DialogFooter className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setMode('edit')} className="gap-2">
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
              <Button onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" /> Baixar PDF
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
