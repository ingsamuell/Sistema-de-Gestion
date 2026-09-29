'use client';

import React, { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { deleteUserAccountAction } from '@/features/profile/actions/deleteUserAccountAction';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  warningText: string;
  cancelText: string;
  confirmText: string;
}

export function DeleteAccountModal({
  isOpen,
  onClose,
  title,
  warningText,
  cancelText,
  confirmText,
}: DeleteAccountModalProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const [isDeleting, startDeleting] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    setErrorMessage(null);
    startDeleting(async () => {
      const res = await deleteUserAccountAction();

      if (!res.success) {
        setErrorMessage(res.error || 'Ocurrió un error al eliminar la cuenta');
        return;
      }

      // Cerrar sesión en el cliente
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error cerrando sesión cliente:', err);
      }

      // Redirigir a login con recarga limpia
      window.location.href = localizedHref(locale, 'login');
    });
  }

  const handleClose = () => {
    if (!isDeleting) {
      setErrorMessage(null);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="relative overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-2xl">
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="absolute right-4 top-4 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low focus:outline-none disabled:opacity-50"
              >
                <X className="size-5" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  <AlertTriangle className="size-6" />
                </div>
                <h2 className="text-xl font-bold text-on-surface">{title}</h2>
                <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
                  {warningText}
                </p>

                {errorMessage && (
                  <p
                    role="alert"
                    className="mt-4 w-full rounded-xl border border-red-200 bg-red-50/80 px-3 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400 text-left"
                  >
                    {errorMessage}
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-3 w-full">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClose}
                    disabled={isDeleting}
                    className="cursor-pointer"
                  >
                    {cancelText}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white min-h-10 gap-2 border-transparent cursor-pointer shadow-sm"
                  >
                    {isDeleting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    {isDeleting ? 'Eliminando...' : confirmText}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
