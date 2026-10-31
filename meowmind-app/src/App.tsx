import { useRef } from 'react';
import { useMindStore } from '@/lib/use-mind-store';
import { MindCanvas } from '@/components/mind/mind-canvas';
import { MindToolbar } from '@/components/mind/mind-toolbar';
import { PropertyPanel } from '@/components/mind/property-panel';
import { Toaster } from 'sonner';

function App() {
  const store = useMindStore();
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50">
      <MindToolbar store={store} contentRef={contentRef} />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          <MindCanvas store={store} />
        </div>
        <PropertyPanel store={store} />
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
