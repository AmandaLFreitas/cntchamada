import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCertificateFields, type CertificateData, type CertificateFields } from '@/lib/certificate-templates';
import { Printer, Download, Pencil, Eye } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CertificateData;
}

export function CertificateDialog({ open, onOpenChange, data }: Props) {
  const [mode, setMode] = useState<'edit' | 'preview'>('preview');
  const [fields, setFields] = useState<CertificateFields | null>(null);
  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setFields(getCertificateFields(data));
      setMode('preview');
    }
  }, [open, data]);

  const updateField = (key: keyof CertificateFields, value: string) => {
    if (!fields) return;
    setFields({ ...fields, [key]: value });
  };

  const handlePrint = () => {
    const content = certRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Certificado</title>
    <link href="https://fonts.googleapis.com/css2?family=Gabriela&display=swap" rel="stylesheet">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Gabriela&display=swap');
      @page { size: A4 landscape; margin: 0; }
      html, body { margin: 0; padding: 0; width: 297mm; height: 210mm; }
      .cert-page {
        width: 297mm !important;
        height: 210mm !important;
        min-height: 210mm !important;
        padding: 25mm 35mm !important;
        font-family: 'Gabriela', 'Georgia', serif !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        color: #000 !important;
        background: #fff !important;
        transform: none !important;
        border: none !important;
        box-shadow: none !important;
        position: relative !important;
      }
    </style></head><body>`);
    const clone = content.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.border = 'none';
    clone.style.boxShadow = 'none';
    w.document.write(clone.outerHTML);
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(() => w.print(), 800);
  };

  const handleDownload = async () => {
    const el = certRef.current;
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 3, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
    pdf.save(`certificado-${fields?.studentName.replace(/\s+/g, '-').toLowerCase() ?? 'aluno'}.pdf`);
  };

  if (!fields) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[1400px] max-h-[95vh] overflow-y-auto p-3">
        <DialogHeader className="flex flex-row items-center justify-between gap-2 flex-wrap pb-2 border-b">
          <DialogTitle className="text-lg">Certificado</DialogTitle>
          <div className="flex gap-2 flex-wrap">
            {mode === 'preview' ? (
              <Button variant="outline" size="sm" onClick={() => setMode('edit')} className="gap-1.5">
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setMode('preview')} className="gap-1.5">
                <Eye className="h-4 w-4" /> Visualizar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button size="sm" onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
          </div>
        </DialogHeader>

        {mode === 'edit' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-2 border-b">
            <div>
              <Label className="text-xs">Nome do Aluno</Label>
              <Input value={fields.studentName} onChange={e => updateField('studentName', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Curso</Label>
              <Input value={fields.courseTitle} onChange={e => updateField('courseTitle', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Módulos</Label>
              <Input value={fields.modules} onChange={e => updateField('modules', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Modalidade</Label>
              <Input value={fields.modalidade} onChange={e => updateField('modalidade', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Frequência</Label>
              <Input value={fields.frequencia} onChange={e => updateField('frequencia', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Carga Horária</Label>
              <Input value={fields.cargaHoraria} onChange={e => updateField('cargaHoraria', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Nota</Label>
              <Input value={fields.nota} onChange={e => updateField('nota', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Data Início</Label>
              <Input value={fields.startDate} onChange={e => updateField('startDate', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Data Fim</Label>
              <Input value={fields.endDate} onChange={e => updateField('endDate', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input value={fields.city} onChange={e => updateField('city', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Data por Extenso</Label>
              <Input value={fields.fullDate} onChange={e => updateField('fullDate', e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        )}

        {/* Certificate Preview */}
        <div className="flex justify-center overflow-auto py-2" style={{ minHeight: '300px' }}>
          <div
            ref={certRef}
            className="cert-page"
            style={{
              width: '297mm',
              height: '210mm',
              padding: '25mm 35mm',
              background: '#fff',
              fontFamily: "'Gabriela', 'Georgia', serif",
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              transform: 'scale(0.52)',
              transformOrigin: 'top center',
              position: 'relative',
              color: '#000',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              flexShrink: 0,
            }}
          >
            {/* Title for some templates */}
            {fields.modules && (
              <p style={{ fontSize: '18pt', textAlign: 'center', margin: '0 0 8mm', letterSpacing: '2px', fontWeight: 'normal' }}>
                Certificado de Conclusão
              </p>
            )}

            {/* Line 1: Certificamos que, NOME */}
            <p style={{ fontSize: '24pt', textAlign: 'center', margin: '0 0 14mm', lineHeight: 1.6 }}>
              Certificamos que,{' '}
              <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                {fields.studentName}
              </span>
            </p>

            {/* Line 2: Concluiu o curso de: CURSO */}
            <p style={{ fontSize: '24pt', textAlign: 'center', margin: '0 0 6mm', lineHeight: 1.6 }}>
              Concluiu o curso de:{' '}
              <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                {fields.courseTitle}
              </span>
            </p>

            {/* Line 3: Modules (if any) */}
            {fields.modules && (
              <p style={{ fontSize: '17pt', textAlign: 'center', margin: '0 0 10mm', lineHeight: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                {fields.modules}
              </p>
            )}

            {/* Line 4: Modalidade – Frequência – Carga horária – Nota */}
            <p style={{ fontSize: '19pt', textAlign: 'center', margin: '0 0 10mm', lineHeight: 1.8 }}>
              Modalidade{' '}
              <span style={{ fontStyle: 'italic', textDecoration: 'underline' }}>{fields.modalidade}</span>
              {' – Frequência '}
              <span style={{ fontStyle: 'italic', fontWeight: 'bold', textDecoration: 'underline' }}>{fields.frequencia}</span>
              {' - Carga horária '}
              <span style={{ fontStyle: 'italic', fontWeight: 'bold', textDecoration: 'underline' }}>{fields.cargaHoraria}</span>
              {' horas - Nota '}
              <span style={{ fontStyle: 'italic', fontWeight: 'bold', textDecoration: 'underline' }}>{fields.nota}</span>
            </p>

            {/* Line 5: Período */}
            <p style={{ fontSize: '19pt', textAlign: 'center', margin: '0 0 10mm', lineHeight: 1.6 }}>
              No período de{' '}
              <span style={{ fontStyle: 'italic', textDecoration: 'underline' }}>{fields.startDate}</span>
              {'  a  '}
              <span style={{ fontStyle: 'italic', textDecoration: 'underline' }}>{fields.endDate}</span>
            </p>

            {/* Line 6: Cidade, data */}
            <p style={{ fontSize: '19pt', textAlign: 'center', margin: '0', fontStyle: 'italic', lineHeight: 1.6 }}>
              {fields.city},{' '}
              <span style={{ fontWeight: 'bold' }}>{fields.fullDate}</span>
            </p>
          </div>
        </div>
        {/* Spacer matching scaled height */}
        <div style={{ height: 'calc(210mm * 0.52)' }} />
      </DialogContent>
    </Dialog>
  );
}
