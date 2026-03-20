import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getCertificateFields, type CertificateData, type CertificateFields } from '@/lib/certificate-templates';
import { Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CertificateData;
}

function InlineEdit({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={e => { if (e.key === 'Enter') setEditing(false); }}
        className="inline-edit-input"
        style={{
          ...style,
          background: 'rgba(59,130,246,0.08)',
          border: '1px dashed #3b82f6',
          borderRadius: '3px',
          padding: '2px 4px',
          outline: 'none',
          font: 'inherit',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          fontWeight: 'inherit',
          fontStyle: 'inherit',
          textDecoration: 'inherit',
          textAlign: 'center' as const,
          minWidth: '40px',
          width: `${Math.max(value.length, 3)}ch`,
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Clique para editar"
      style={{
        ...style,
        cursor: 'pointer',
        borderBottom: '1px dashed rgba(59,130,246,0.4)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {value || '—'}
    </span>
  );
}

export function CertificateDialog({ open, onOpenChange, data }: Props) {
  const [fields, setFields] = useState<CertificateFields | null>(null);
  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setFields(getCertificateFields(data));
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
      }
      .inline-edit-input { display: none !important; }
      span[title] { border-bottom: none !important; cursor: default !important; }
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
    // Temporarily remove edit hints for capture
    const editSpans = el.querySelectorAll('span[title]');
    editSpans.forEach(s => {
      (s as HTMLElement).style.borderBottom = 'none';
    });
    const canvas = await html2canvas(el, { scale: 3, useCORS: true });
    editSpans.forEach(s => {
      (s as HTMLElement).style.borderBottom = '1px dashed rgba(59,130,246,0.4)';
    });
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
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button size="sm" onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
          </div>
        </DialogHeader>

        <p className="text-xs text-muted-foreground text-center py-1">Clique em qualquer campo do certificado para editar</p>

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
            {fields.modules && (
              <p style={{ fontSize: '18pt', textAlign: 'center', margin: '0 0 8mm', letterSpacing: '2px', fontWeight: 'normal' }}>
                Certificado de Conclusão
              </p>
            )}

            <p style={{ fontSize: '24pt', textAlign: 'center', margin: '0 0 14mm', lineHeight: 1.6 }}>
              Certificamos que,{' '}
              <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                <InlineEdit value={fields.studentName} onChange={v => updateField('studentName', v)} />
              </span>
            </p>

            <p style={{ fontSize: '24pt', textAlign: 'center', margin: '0 0 6mm', lineHeight: 1.6 }}>
              Concluiu o curso de:{' '}
              <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                <InlineEdit value={fields.courseTitle} onChange={v => updateField('courseTitle', v)} />
              </span>
            </p>

            {fields.modules && (
              <p style={{ fontSize: '17pt', textAlign: 'center', margin: '0 0 10mm', lineHeight: 1.5, fontWeight: 'bold', textDecoration: 'underline' }}>
                <InlineEdit value={fields.modules} onChange={v => updateField('modules', v)} />
              </p>
            )}

            <p style={{ fontSize: '19pt', textAlign: 'center', margin: '0 0 10mm', lineHeight: 1.8 }}>
              Modalidade{' '}
              <span style={{ fontStyle: 'italic', textDecoration: 'underline' }}>
                <InlineEdit value={fields.modalidade} onChange={v => updateField('modalidade', v)} />
              </span>
              {' – Frequência '}
              <span style={{ fontStyle: 'italic', fontWeight: 'bold', textDecoration: 'underline' }}>
                <InlineEdit value={fields.frequencia} onChange={v => updateField('frequencia', v)} />
              </span>
              {' - Carga horária '}
              <span style={{ fontStyle: 'italic', fontWeight: 'bold', textDecoration: 'underline' }}>
                <InlineEdit value={fields.cargaHoraria} onChange={v => updateField('cargaHoraria', v)} />
              </span>
              {' horas - Nota '}
              <span style={{ fontStyle: 'italic', fontWeight: 'bold', textDecoration: 'underline' }}>
                <InlineEdit value={fields.nota} onChange={v => updateField('nota', v)} />
              </span>
            </p>

            <p style={{ fontSize: '19pt', textAlign: 'center', margin: '0 0 10mm', lineHeight: 1.6 }}>
              No período de{' '}
              <span style={{ fontStyle: 'italic', textDecoration: 'underline' }}>
                <InlineEdit value={fields.startDate} onChange={v => updateField('startDate', v)} />
              </span>
              {'  a  '}
              <span style={{ fontStyle: 'italic', textDecoration: 'underline' }}>
                <InlineEdit value={fields.endDate} onChange={v => updateField('endDate', v)} />
              </span>
            </p>

            <p style={{ fontSize: '19pt', textAlign: 'center', margin: '0', fontStyle: 'italic', lineHeight: 1.6 }}>
              <InlineEdit value={fields.city} onChange={v => updateField('city', v)} />,{' '}
              <span style={{ fontWeight: 'bold' }}>
                <InlineEdit value={fields.fullDate} onChange={v => updateField('fullDate', v)} />
              </span>
            </p>
          </div>
        </div>
        <div style={{ height: 'calc(210mm * 0.52)' }} />
      </DialogContent>
    </Dialog>
  );
}
