import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface PhotoLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt?: string;
}

export function PhotoLightbox({ open, onOpenChange, src, alt = 'Foto' }: PhotoLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 sm:p-4 bg-black/90 border-none flex items-center justify-center">
        <VisuallyHidden><DialogTitle>Visualizar foto</DialogTitle></VisuallyHidden>
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
      </DialogContent>
    </Dialog>
  );
}
