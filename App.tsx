
import React, { useState, useCallback, useMemo } from 'react';
import { translateTextBatch } from './services/geminiService';
import { extractTextsFromPptx, rebuildPptxWithTranslatedTexts } from './services/pptxService';
import { UploadIcon, FileIcon, DownloadIcon, LoaderIcon } from './components/Icons';

type Status = 'idle' | 'loading' | 'processing' | 'translating' | 'generating' | 'success' | 'error';

type SlideText = {
    path: string;
    texts: string[];
};

export default function App() {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<Status>('idle');
    const [statusMessage, setStatusMessage] = useState('فایلێک هەڵبژێرە بۆ دەستپێکردن');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [translatedFileBlob, setTranslatedFileBlob] = useState<Blob | null>(null);
    const [originalTexts, setOriginalTexts] = useState<SlideText[]>([]);
    const [dragActive, setDragActive] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files[0]) {
            if (files[0].name.endsWith('.pptx')) {
                setFile(files[0]);
                setStatus('idle');
                setErrorMessage(null);
                setTranslatedFileBlob(null);
                setStatusMessage(`فایلی "${files[0].name}" ئامادەیە بۆ وەرگێڕان.`);
            } else {
                setErrorMessage('تکایە تەنها فایلی .pptx باربکە');
                setFile(null);
            }
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const files = e.dataTransfer.files;
        if (files && files[0]) {
            if (files[0].name.endsWith('.pptx')) {
                setFile(files[0]);
                setStatus('idle');
                setErrorMessage(null);
                setTranslatedFileBlob(null);
                setStatusMessage(`فایلی "${files[0].name}" ئامادەیە بۆ وەرگێڕان.`);
            } else {
                setErrorMessage('تکایە تەنها فایلی .pptx باربکە');
                setFile(null);
            }
        }
    };

    const handleTranslate = useCallback(async () => {
        if (!file) {
            setErrorMessage("تکایە سەرەتا فایلێک هەڵبژێرە");
            return;
        }

        setStatus('processing');
        setStatusMessage('خوێندنەوەی فایل...');
        setErrorMessage(null);
        setTranslatedFileBlob(null);

        try {
            const extractedData = await extractTextsFromPptx(file);
            setOriginalTexts(extractedData);
            const allTexts = extractedData.flatMap(slide => slide.texts);

            if (allTexts.length === 0) {
                setStatus('error');
                setErrorMessage('هیچ نووسینێک لە فایلەکەدا نەدۆزرایەوە بۆ وەرگێڕان.');
                return;
            }

            setStatus('translating');
            setStatusMessage(`وەرگێڕانی ${allTexts.length} پارچە نووسین...`);

            const translatedTexts = await translateTextBatch(allTexts);

            if (translatedTexts.length !== allTexts.length) {
                throw new Error("ژمارەی نووسینە وەرگێڕدراوەکان هاوتا نییە لەگەڵ ئەسڵەکە.");
            }
            
            setStatus('generating');
            setStatusMessage('دروستکردنی فایلی نوێ...');

            let textIndex = 0;
            const translatedSlides: SlideText[] = extractedData.map(slide => {
                const count = slide.texts.length;
                const newTexts = translatedTexts.slice(textIndex, textIndex + count);
                textIndex += count;
                return { path: slide.path, texts: newTexts };
            });

            const newFileBlob = await rebuildPptxWithTranslatedTexts(file, translatedSlides);
            setTranslatedFileBlob(newFileBlob);
            setStatus('success');
            setStatusMessage('وەرگێڕان تەواو بوو! ئێستا دەتوانیت فایلی نوێ دابگریت.');

        } catch (error) {
            console.error(error);
            setStatus('error');
            const message = error instanceof Error ? error.message : 'هەڵەیەک ڕوویدا';
            setErrorMessage(`هەڵە لە کاتی وەرگێڕان: ${message}`);
        }
    }, [file]);

    const handleDownload = () => {
        if (translatedFileBlob && file) {
            const url = URL.createObjectURL(translatedFileBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kurdish-${file.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };
    
    const isProcessing = useMemo(() => ['processing', 'translating', 'generating'].includes(status), [status]);

    return (
        <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans" onDragEnter={handleDrag}>
            <div className="w-full max-w-2xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-cyan-400">وەرگێڕی پاوەرپۆینت</h1>
                    <p className="text-slate-400 mt-2 text-lg">فایلەکانی .pptx لە ئینگلیزیەوە وەرگێڕە بۆ کوردی</p>
                </header>

                <main className="bg-slate-800 rounded-xl shadow-2xl p-6 md:p-8 border border-slate-700">
                    <div className="flex flex-col items-center space-y-6">
                        <form id="form-file-upload" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} className="w-full">
                             <label htmlFor="input-file-upload" className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-slate-800/50 hover:bg-slate-700/50 transition-colors ${dragActive ? "border-cyan-400" : "border-slate-600"}`}>
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadIcon className="w-10 h-10 mb-3 text-slate-400"/>
                                    <p className="mb-2 text-sm text-slate-400"><span className="font-semibold">کرتە بکە بۆ بارکردن</span> یان ڕایبکێشە و دایبنێ</p>
                                    <p className="text-xs text-slate-500">تەنها PPTX</p>
                                </div>
                                <input id="input-file-upload" type="file" className="hidden" accept=".pptx" onChange={handleFileChange} />
                            </label>
                        </form>

                        {file && (
                           <div className="w-full bg-slate-700 p-4 rounded-lg flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <FileIcon className="w-6 h-6 text-cyan-400 flex-shrink-0"/>
                                    <span className="text-slate-300 truncate">{file.name}</span>
                                </div>
                                <button onClick={() => { setFile(null); setStatus('idle'); setTranslatedFileBlob(null); setErrorMessage(null); setStatusMessage('فایلێک هەڵبژێرە بۆ دەستپێکردن') }} className="text-slate-400 hover:text-red-500 transition-colors text-sm font-bold">لابردن</button>
                            </div>
                        )}

                        <div className="w-full flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                            <button
                                onClick={handleTranslate}
                                disabled={!file || isProcessing}
                                className="w-full sm:w-auto flex items-center justify-center px-8 py-3 text-base font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                            >
                                {isProcessing && <LoaderIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />}
                                {isProcessing ? 'وەرگێڕان...' : 'دەستپێکردنی وەرگێڕان'}
                            </button>
                            {status === 'success' && translatedFileBlob && (
                                <button
                                    onClick={handleDownload}
                                    className="w-full sm:w-auto flex items-center justify-center px-8 py-3 text-base font-medium rounded-md text-slate-900 bg-green-400 hover:bg-green-500 transition-all duration-300 shadow-lg"
                                >
                                    <DownloadIcon className="mr-3 h-5 w-5" />
                                    داگرتنی فایلی وەرگێڕدراو
                                </button>
                            )}
                        </div>

                        <div className="w-full text-center pt-4">
                            {errorMessage && <p className="text-red-400">{errorMessage}</p>}
                            {statusMessage && !errorMessage && <p className="text-slate-400">{statusMessage}</p>}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
