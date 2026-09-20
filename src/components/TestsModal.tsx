import React, { useState, useEffect } from 'react';
import {
  X,
  FlaskConical,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Zap,
  Terminal,
} from 'lucide-react';
import { TestCaseResult } from '../types';
import { runAllTests } from '../lib/zatcaTests';

interface TestsModalProps {
  onClose: () => void;
}

export const TestsModal: React.FC<TestsModalProps> = ({ onClose }) => {
  const [tests, setTests] = useState<TestCaseResult[]>([]);
  const [isRunning, setIsRunning] = useState(true);

  const executeTests = async () => {
    setIsRunning(true);
    // Slight pause to provide pleasant UX transition
    await new Promise((res) => setTimeout(res, 250));
    const results = await runAllTests();
    setTests(results);
    setIsRunning(false);
  };

  useEffect(() => {
    executeTests();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const totalPassed = tests.filter((t) => t.passed).length;
  const allPassed = tests.length > 0 && totalPassed === tests.length;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-6 border border-slate-200"
      >
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>فحص النظام والاختبارات الآلية (Unit & Integration Tests)</span>
              </h2>
              <p className="text-xs text-slate-400">
                التحقق البرمجي من الحسابات الضريبية، عزل البيانات، وتوليد ZATCA TLV QR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={executeTests}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              title="إعادة تشغيل الفحص"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>إعادة الفحص</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Results summary pill */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isRunning ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>جارِ تنفيذ مجموعة الاختبارات الآلية...</span>
              </div>
            ) : allPassed ? (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100/80 px-3 py-1.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>جميع الاختبارات اجتازت بنجاح كامل ({totalPassed}/{tests.length})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-800 bg-rose-100/80 px-3 py-1.5 rounded-full border border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>فشل بعض الاختبارات ({totalPassed}/{tests.length})</span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>فحص الحسابات البرمجية ومواصفات QR TLV</span>
          </div>
        </div>

        {/* Tests List */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
          {tests.map((test, index) => (
            <div
              key={test.id}
              className={`p-4 rounded-xl border text-xs transition-all ${
                test.passed
                  ? 'bg-white border-slate-200/80 hover:border-slate-300'
                  : 'bg-rose-50/60 border-rose-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {index + 1}. {test.titleAr}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono" dir="ltr">
                      ({test.titleEn})
                    </span>
                  </div>

                  <p className="text-slate-600 leading-relaxed pt-0.5">
                    {test.details}
                  </p>

                  {(test.expected || test.actual) && (
                    <div className="pt-2 font-mono text-[11px] text-slate-500 space-y-0.5 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                      {test.expected && (
                        <div>
                          <span className="text-slate-700 font-bold">المتوقع (Expected):</span> {test.expected}
                        </div>
                      )}
                      {test.actual && (
                        <div>
                          <span className="text-emerald-700 font-bold">الفعلي (Actual):</span> {test.actual}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {test.passed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ناجح (PASS)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>فشل (FAIL)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600">
            تم فحص: الحسابات، التحقق، ترميز TLV، والعزل بين المنشآت
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
