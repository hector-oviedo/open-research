declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | [number, number] | [number, number, number, number];
    filename?: string;
    image?: {
      type?: 'jpeg' | 'png' | 'webp';
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      letterRendering?: boolean;
      [key: string]: unknown;
    };
    jsPDF?: {
      unit?: 'pt' | 'mm' | 'cm' | 'in';
      format?: 'a0' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'letter' | 'legal' | [number, number];
      orientation?: 'portrait' | 'landscape';
      [key: string]: unknown;
    };
  }

  interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(element: HTMLElement | string): Html2PdfWorker;
    toPdf(): Html2PdfWorker;
    save(filename?: string): Promise<void>;
    output(type: string, options?: unknown): Promise<unknown>;
  }

  function html2pdf(): Html2PdfWorker;

  export default html2pdf;
}
