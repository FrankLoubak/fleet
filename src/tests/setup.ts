import '@testing-library/jest-dom';

// pdfjs-dist (usado por src/utils/parseNFe.ts, módulo de pneus) referencia `DOMMatrix`
// no carregamento do módulo — jsdom não implementa essa API de canvas, e nenhum teste
// exercita renderização real de PDF, então um stub mínimo evita o ReferenceError sem
// mudar nenhum comportamento de produção (o browser real sempre tem DOMMatrix).
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-expect-error stub mínimo só para satisfazer a referência em tempo de import
  globalThis.DOMMatrix = class DOMMatrix {};
}

// jsdom não implementa `URL.createObjectURL`/`revokeObjectURL` — usado por
// ExcelExporter/PdfExporter/TxtExporter (Rodada C / C4) e pelo próprio jsPDF.save()
// para disparar o download do relatório. Stub mínimo (URL fake, sem revogação real)
// só para o código não lançar `TypeError: ... is not a function`; testes que
// precisam inspecionar o Blob gerado sobrescrevem isto com `vi.spyOn`.
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = () => 'blob:mock';
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = () => {};
}

// jsdom não implementa `window.matchMedia` — react-hot-toast (<Toaster>, montado em todo
// <App/>) usa isso para detectar prefers-reduced-motion. Stub padrão "sem preferência" (matches:
// false) é suficiente para os testes; qualquer browser real já implementa isso nativamente.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}
